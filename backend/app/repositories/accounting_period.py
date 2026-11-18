from datetime import datetime,timezone
from sqlalchemy import select
from app.models.accounting_period import AccountingPeriod,AccountingPeriodEvent
from app.models.company import Company


def lock_company(db,company):
    return db.execute(select(Company.id).where(Company.id==company).with_for_update()).scalar_one_or_none()


def closed_months(db,company):
    return set(db.scalars(select(AccountingPeriod.month).where(AccountingPeriod.company_id==company,AccountingPeriod.status=="closed")))


def period(db,company,month):
    return db.query(AccountingPeriod).filter_by(company_id=company,month=month).first()


def year(db,company,year):
    return db.query(AccountingPeriod).filter(AccountingPeriod.company_id==company,AccountingPeriod.month.like(str(year)+"-%")).order_by(AccountingPeriod.month).all()


def events(db,company,period_id):
    return db.query(AccountingPeriodEvent).filter_by(company_id=company,period_id=period_id).order_by(AccountingPeriodEvent.id.desc()).limit(100).all()


def original_scope(db,table,id,date_column):
    return db.execute(select(table.c.company_id,table.c[date_column]).where(table.c.id==id)).first()


def parent(db,kind,id):
    from app.models.invoice import Invoice
    from app.models.customer_payment import CustomerPayment
    from app.models.inventory import InventoryMovement
    from app.models.bank_reconciliation import BankStatementEntry
    models={"invoice":(Invoice,"issue_date"),"payment":(CustomerPayment,"received_at"),"movement":(InventoryMovement,"created_at"),"bank":(BankStatementEntry,"booked_at")}
    model,column=models[kind]
    return db.execute(select(model.company_id,getattr(model,column)).where(model.id==id)).first()


def records(db,company,start,end):
    from app.models.invoice import Invoice
    from app.models.expense import Expense
    from app.models.sales_ledger_record import SalesLedgerRecord
    from app.models.customer_payment import CustomerPayment
    from app.models.inventory import InventoryMovement
    from app.models.bank_reconciliation import BankStatementEntry
    models=[(Invoice,"issue_date"),(Expense,"expense_date"),(SalesLedgerRecord,"entry_date"),(CustomerPayment,"received_at"),(InventoryMovement,"created_at"),(BankStatementEntry,"booked_at")]
    for model,date_field in models:
        first,last=(start.date(),end.date()) if date_field=="entry_date" else (start,end)
        yield model.__tablename__,db.query(model).filter(model.company_id==company,getattr(model,date_field)>=first,getattr(model,date_field)<last).order_by(model.id).yield_per(500)
