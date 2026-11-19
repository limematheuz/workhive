"""Map persisted financial mutations to the period they would change."""
from sqlalchemy import inspect
from app.repositories import accounting_period as repo

REPORTABLE={"issued","partially_paid","paid","overdue","rectified"}
# Operational forecasts and time reviews are deliberately independent of accounting books.
SPECS={
 "invoices":("issue_date",{"company_id","client_id","issue_date","base_amount","tax_amount","total_amount","discount","equivalence_surcharge","retention","is_active","is_rectification","original_invoice_id","invoice_number","currency","exchange_rate_to_eur","exchange_rate_date","currency_snapshot"}),
 "expenses":("expense_date",{"company_id","client_id","expense_date","base_amount","tax_amount","total_amount","is_active","service_contract_id","work_order_id","currency","exchange_rate_to_eur","exchange_rate_date","currency_snapshot"}),
 "sales_ledger_records":("entry_date",{"company_id","entry_date","document_number","client_name","base_amount","tax_amount","total_amount","is_active","payment_status","currency","exchange_rate_to_eur","exchange_rate_date","currency_snapshot"}),
 "customer_payments":("received_at",{"company_id","client_id","received_at","amount","status","currency","exchange_rate_to_eur","exchange_rate_date","currency_snapshot"}),
 "inventory_movements":("created_at",{"company_id","client_id","created_at","quantity","unit_cost","movement_type","material_id","warehouse_id","work_order_id","reversal_of_movement_id"}),
 "bank_statement_entries":("booked_at",{"company_id","booked_at","amount","currency"}),
}
PARENTS={"invoice_items":("invoice","invoice_id"),"customer_payment_allocations":("payment","payment_id"),"bank_reconciliations":("bank","bank_statement_entry_id")}


def changed(row):
    state=inspect(row)
    return {attr.key for attr in state.mapper.column_attrs if state.attrs[attr.key].history.has_changes()}


def scopes(db,row,mutation):
    name=row.__tablename__;state=inspect(row);fields=changed(row)
    if name in SPECS:
        date_column,protected=SPECS[name]
        status=state.attrs.status.history if name=="invoices" else None
        status_affects_books=status and status.has_changes() and not(set(status.added)|set(status.deleted))<=REPORTABLE
        if mutation=="update" and not(fields&protected) and not status_affects_books:return []
        values=[(row.company_id,getattr(row,date_column))]
        if mutation!="insert":
            original=repo.original_scope(db,row.__table__,row.id,date_column)
            if original:values.append(tuple(original))
        if name=="inventory_movements" and row.reversal_of_movement_id:
            parent=repo.parent(db,"movement",row.reversal_of_movement_id)
            if parent:values.append(tuple(parent))
        return values
    if name in PARENTS:
        if mutation=="update" and not fields:return []
        kind,field=PARENTS[name]
        ids={getattr(row,field)}
        if mutation!="insert":ids.update(state.attrs[field].history.deleted)
        values=[]
        for id in ids:
            if id is None:continue
            current=repo.parent(db,kind,id)
            if current:values.append(tuple(current))
        return values
    return []
