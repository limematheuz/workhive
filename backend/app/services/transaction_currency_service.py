from decimal import Decimal
from copy import deepcopy
from app.models.audit_log import AuditLog
from fastapi import HTTPException
from pydantic import ValidationError
from fastapi.encoders import jsonable_encoder
from app.repositories import transaction_currency as repo,customer_payment as payment_repo
from app.schemas.transaction_currency import NativePayment,NativeSale
from app.schemas.invoice import InvoiceDraftCreate,InvoiceUpdate
from app.schemas.invoice_item import InvoiceItemCreate
from app.schemas.expense import ExpenseCreate,ExpenseUpdate
from app.schemas.customer_payment import CustomerPaymentCreate
from app.schemas.sales_ledger import SalesLedgerManualRecordCreate,SalesLedgerManualRecordUpdate
from app.services import invoice_service,expense_service,customer_payment_service,sales_ledger_service,currency_payment_service
from app.services import currency_policy as policy
from app.services.organization_authorization_service import require_capability,has_capability
from app.services.user_scope import require_company_context
from app.services.entitlement_service import require_company_feature

SCHEMAS={"invoices":InvoiceDraftCreate,"expenses":ExpenseCreate,"payments":NativePayment,"sales":NativeSale}


def principal(db,user,manage=False):
    company=require_company_context(user);require_capability(db,user,"finance.manage" if manage else "finance.read");require_company_feature(db,company_id=company,code="features.invoices");return company


def serialized(kind,row):
    snapshot=deepcopy(row.currency_snapshot or {})
    edit_document=deepcopy(snapshot.get("original_document",{}))
    for key in ("client_id","service_contract_id","work_order_id","notes","terms","description","vendor","category","client_name","document_number","payment_status","payment_method","receipt_url","shipping_address","custom_issuer_info","custom_recipient_info","signature_url"):
        if hasattr(row,key):edit_document[key]=getattr(row,key)
    date_field={"invoices":"issue_date","expenses":"expense_date","payments":"received_at","sales":"entry_date"}[kind]
    edit_document[date_field]=getattr(row,date_field).isoformat()
    return dict(id=row.id,kind=kind,label=getattr(row,"invoice_number",None) or getattr(row,"document_number",None) or getattr(row,"description",None) or "Cobro #"+str(row.id),
        status=getattr(row,"status",None) or ("active" if row.is_active else "deleted"),currency_snapshot=snapshot,edit_document=edit_document,
        editable=kind!="payments" and (row.status=="draft" if kind=="invoices" else row.is_active),
        amount_eur=str(row.amount if kind=="payments" else row.total_amount))


def read(db,user):
    company=principal(db,user);invoices=repo.invoices(db,company)
    allocated=payment_repo.allocated_amounts_for_invoices(db,company_id=company,invoice_ids=[row.id for row in invoices])
    return dict(currencies=sorted(policy.CODES),minor_units=policy.MINOR_UNITS,clients=[dict(id=row.id,name=row.name) for row in repo.clients(db,company)],
        can_manage=has_capability(db,user,"finance.manage"),
        invoices=[dict(id=row.id,number=row.invoice_number,client_id=row.client_id,outstanding_eur=str(Decimal(str(row.total_amount))-allocated.get(row.id,Decimal("0"))),
            currency_snapshot=row.currency_snapshot) for row in invoices],
        records=[serialized(kind,row) for kind in SCHEMAS for row in repo.recent(db,company,kind)])


def parsed(kind,document):
    if kind not in SCHEMAS:raise HTTPException(404,"Tipo de operación no encontrado.")
    try:return SCHEMAS[kind].model_validate(document)
    except ValidationError as error:raise HTTPException(422,detail=jsonable_encoder(error.errors(),custom_encoder={ValueError:str}))


def amounts(row,kind):
    return dict(total_amount=Decimal(str(row.amount))) if kind=="payments" else {key:Decimal(str(getattr(row,key))) for key in ("base_amount","tax_amount","total_amount")}


def save(db,user,kind,spec,id=None):
    company=principal(db,user,manage=True);native=parsed(kind,spec.document)
    if kind!="payments" and spec.settle_invoice_id is not None:raise HTTPException(422,"La liquidación de facturas solo se aplica a cobros.")
    at=native.issue_date if kind=="invoices" else native.expense_date if kind=="expenses" else native.received_at if kind=="payments" else native.entry_date
    policy.validate(spec,at)
    existing=repo.record(db,company,kind,id,lock=True) if id else None
    if id and existing is None:raise HTTPException(404,"Operación no encontrada.")
    if existing and not existing.currency_snapshot:raise HTTPException(409,"Los registros históricos EUR conservan su moneda. Crea una nueva operación en la moneda original.")
    if existing and (kind=="payments" or kind=="invoices" and existing.status!="draft"):raise HTTPException(409,"La operación es inmutable. Registra una corrección o rectificación.")
    settlement=None
    if kind=="payments" and spec.settle_invoice_id:
        settlement=repo.record(db,company,"invoices",spec.settle_invoice_id,lock=True)
        if settlement is None or settlement.client_id!=native.client_id:raise HTTPException(404,"Factura no encontrada para el cliente.")
    previous=deepcopy(existing.currency_snapshot) if existing else None
    try:
        with policy.writing(db):
            data=native.model_dump()
            if id:
                for key in ("notes","terms","receipt_url","payment_method","shipping_address","custom_issuer_info","custom_recipient_info","signature_url"):
                    if key not in spec.document:data.pop(key,None)
            if kind=="invoices":
                original,lines=policy.invoice_amounts(native,spec.currency)
                data["items"]=policy.invoice_items(native,spec,lines)
                converted=InvoiceDraftCreate(**data)
                row=invoice_service.update_invoice(db,company,id,InvoiceUpdate(**converted.model_dump(exclude_unset=True)),commit=False) if id else invoice_service.create_invoice_draft(db,company,converted,commit=False)
                expected=[(Decimal(str(item.quantity)),Decimal(str(item.unit_price))) for item in converted.items]
                if [(Decimal(str(item.quantity)),Decimal(str(item.unit_price))) for item in row.items]!=expected:raise HTTPException(409,"Los trabajos vinculados tienen un precio acordado en EUR distinto. Revisa los importes originales antes de facturar.")
            elif kind=="expenses":
                original=dict(base_amount=Decimal(str(native.base_amount)),tax_amount=Decimal(str(native.tax_amount)),total_amount=Decimal(str(native.base_amount))+Decimal(str(native.tax_amount)))
                data.update(base_amount=float(policy.converted(native.base_amount,spec)),tax_amount=float(policy.converted(native.tax_amount,spec)))
                if id:data.pop("receipt_url",None)
                row=expense_service.update_expense(db,company,id,ExpenseUpdate(**data),commit=False) if id else expense_service.create_expense(db,company,user.id,ExpenseCreate(**data),commit=False)
            elif kind=="sales":
                original=dict(base_amount=native.base_amount,tax_amount=native.tax_amount,total_amount=native.base_amount+native.tax_amount)
                data.update(base_amount=policy.converted(native.base_amount,spec),tax_amount=policy.converted(native.tax_amount,spec))
                created=sales_ledger_service.update_manual_record(db,company,id,SalesLedgerManualRecordUpdate(**data),commit=False) if id else sales_ledger_service.create_manual_record(db,company,user.id,SalesLedgerManualRecordCreate(**data),commit=False)
                row=repo.record(db,company,kind,created.source_id)
            else:
                if native.allocations:raise HTTPException(422,"Usa la factura e importe original a liquidar; los repartos internos se calculan en EUR.")
                original=dict(total_amount=native.amount);data.update(amount=policy.converted(native.amount,spec),allocations=[])
                if data["amount"]<=0:raise HTTPException(422,"El cobro convertido debe representar al menos un céntimo EUR.")
                row=customer_payment_service.create_payment(db,user,CustomerPaymentCreate(**data),commit=False)
                currency_payment_service.settle(db,company,row,spec,native,settlement)
            for value in original.values():policy.validate_amount(value,spec.currency)
            row.currency_snapshot=policy.snapshot(spec,native,original,amounts(row,kind),user)
            if kind=="invoices":row.currency_snapshot["original_lines"]=lines
            if kind=="payments":
                db.expire(row,["allocations"])
                row.currency_snapshot["realized_exchange_difference_eur"]=str(sum((Decimal(str(entry.exchange_difference_eur or 0)) for entry in row.allocations),Decimal("0")))
            db.add(AuditLog(company_id=company,actor_user_id=user.id,action="finance.currency_updated" if id else "finance.currency_created",entity_type={"invoices":"invoice","expenses":"expense","payments":"customer_payment","sales":"sales_ledger_record"}[kind],entity_id=str(row.id),
                details=dict(currency=spec.currency,eur_rate=str(spec.eur_rate),rate_date=spec.rate_date.isoformat(),original_amounts=row.currency_snapshot["original_amounts"],eur_amounts=row.currency_snapshot["eur_amounts"],previous_original_amounts=previous.get("original_amounts") if previous else None,previous_eur_rate=previous.get("eur_rate") if previous else None,previous_currency=previous.get("currency") if previous else None)))
            db.flush();db.commit();db.refresh(row)
    except Exception:db.rollback();raise
    return serialized(kind,row)
