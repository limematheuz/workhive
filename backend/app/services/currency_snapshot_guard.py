"""Prevent base-EUR edits from leaving an original-currency snapshot stale."""
from sqlalchemy import inspect,select
from fastapi import HTTPException

FIELDS={"invoices":{"client_id","issue_date","discount","equivalence_surcharge","retention","base_amount","tax_amount","total_amount","currency_snapshot"},
 "expenses":{"client_id","expense_date","base_amount","tax_amount","total_amount","currency_snapshot"},
 "sales_ledger_records":{"entry_date","base_amount","tax_amount","total_amount","currency_snapshot"},
 "customer_payments":{"received_at","amount","currency_snapshot"}}


def check(db,row,mutation):
    if db.info.get("currency_write"):return
    name=row.__tablename__
    if name in FIELDS and mutation=="update":
        snapshot=row.currency_snapshot
        if not snapshot:
            prior=inspect(row).attrs.currency_snapshot.history.deleted
            snapshot=prior[0] if prior else None
        if snapshot and snapshot.get("currency")!="EUR":
            fields={attr.key for attr in inspect(row).mapper.column_attrs if inspect(row).attrs[attr.key].history.has_changes()}
            if fields&FIELDS[name]:raise HTTPException(409,"Esta operación tiene moneda original. Edita sus importes desde Finanzas → Monedas para conservar el cambio y su trazabilidad.")
    elif name=="invoice_items":
        from app.repositories.transaction_currency import invoice_snapshot
        snapshot=invoice_snapshot(db,row.invoice_id)
        if snapshot and snapshot.get("currency")!="EUR":raise HTTPException(409,"Edita las líneas de esta factura desde Finanzas → Monedas para conservar los importes originales.")
