from collections import Counter
from datetime import date,datetime,timezone
from decimal import Decimal
from hashlib import sha256
import json
from app.repositories import accounting_period as repo
from app.services.accounting_record_scope import SPECS,REPORTABLE
from app.services.estimator_cost_policy import money,ZERO


def dates(month):
    start=datetime.strptime(month,"%Y-%m").replace(tzinfo=timezone.utc)
    if start.strftime("%Y-%m")!=month or not 2000<=start.year<=9998:raise ValueError()
    return start,start.replace(year=start.year+(start.month==12),month=start.month%12+1)


def serialized(value):
    if isinstance(value,(date,datetime)):return value.isoformat()
    if isinstance(value,Decimal):return str(value)
    return value


def build(db,company,month):
    start,end=dates(month);digest=sha256();counts={};totals=Counter();invoice_numbers=set();manual=[]
    for name,records in repo.records(db,company,start,end):
        count=0
        for row in records:
            count+=1
            columns=set(SPECS[name][1])&set(row.__table__.columns.keys())
            record={key:serialized(getattr(row,key)) for key in sorted(columns|{"id"})}
            if name=="invoices":
                record["status"]="recognized" if row.status in REPORTABLE else row.status
                if row.is_active and row.status in REPORTABLE:
                    totals["invoice_base"]+=Decimal(str(row.base_amount));totals["invoice_tax"]+=Decimal(str(row.tax_amount));totals["invoice_total"]+=Decimal(str(row.total_amount));invoice_numbers.add(row.invoice_number.strip().casefold())
                if row.status=="draft" and row.is_active:totals["draft_invoices"]+=1
            elif name=="expenses" and row.is_active:
                totals["expense_base"]+=Decimal(str(row.base_amount));totals["expense_tax"]+=Decimal(str(row.tax_amount));totals["expense_total"]+=Decimal(str(row.total_amount))
            elif name=="sales_ledger_records" and row.is_active:
                manual.append((row.document_number.strip().casefold(),Decimal(str(row.base_amount)),Decimal(str(row.tax_amount))))
            elif name=="customer_payments" and row.status=="received":totals["receipts_total"]+=Decimal(str(row.amount))
            elif name=="bank_statement_entries":totals["bank_credits_total"]+=Decimal(str(row.amount))
            elif name=="inventory_movements" and row.unit_cost is None:totals["uncosted_stock_movements"]+=1
            digest.update((name+" "+json.dumps(record,sort_keys=True,ensure_ascii=False,default=str)+"\n").encode("utf-8"))
        counts[name]=count
    for number,base,tax in manual:
        if number not in invoice_numbers:totals["manual_base"]+=base;totals["manual_tax"]+=tax
    amounts={key:str(money(Decimal(totals[key]))) for key in ("invoice_base","invoice_tax","invoice_total","manual_base","manual_tax","expense_base","expense_tax","expense_total","receipts_total","bank_credits_total")}
    from app.repositories.transaction_currency import exchange_difference
    amounts["realized_exchange_difference"]=str(money(Decimal(str(exchange_difference(db,company,start,end)))))
    amounts["revenue_base"]=str(money(Decimal(totals["invoice_base"])+Decimal(totals["manual_base"])))
    return dict(schema_version=1,month=month,timezone="UTC",base_currency="EUR",record_counts=counts,amounts=amounts,
        draft_invoices=int(totals["draft_invoices"]),uncosted_stock_movements=int(totals["uncosted_stock_movements"]),fingerprint=digest.hexdigest(),captured_at=datetime.now(timezone.utc).isoformat())
