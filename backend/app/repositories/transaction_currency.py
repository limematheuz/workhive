from sqlalchemy import select
from app.models.invoice import Invoice
from app.models.expense import Expense
from app.models.customer_payment import CustomerPayment,CustomerPaymentAllocation
from app.models.sales_ledger_record import SalesLedgerRecord
from app.models.client import Client

MODELS={"invoices":Invoice,"expenses":Expense,"payments":CustomerPayment,"sales":SalesLedgerRecord}


def record(db,company,kind,id,lock=False):
    query=db.query(MODELS[kind]).filter_by(company_id=company,id=id)
    return query.with_for_update().first() if lock else query.first()


def recent(db,company,kind):
    model=MODELS[kind]
    return db.query(model).filter(model.company_id==company,model.currency_snapshot.isnot(None)).order_by(model.id.desc()).limit(50).all()


def clients(db,company):
    return db.query(Client).filter_by(company_id=company,is_active=True).order_by(Client.name).all()


def invoices(db,company):
    return db.query(Invoice).filter(Invoice.company_id==company,Invoice.is_active.is_(True),Invoice.total_amount>0,Invoice.status.in_(["issued","overdue","partially_paid"])).order_by(Invoice.id.desc()).limit(300).all()


def settlements(db,company,invoice):
    return db.query(CustomerPaymentAllocation).join(CustomerPayment,CustomerPayment.id==CustomerPaymentAllocation.payment_id).filter(
        CustomerPayment.company_id==company,CustomerPayment.status=="received",CustomerPaymentAllocation.invoice_id==invoice).all()


def period_records(db,company,kind,start,end):
    model=MODELS[kind];field={"invoices":"issue_date","expenses":"expense_date","payments":"received_at","sales":"entry_date"}[kind]
    first,last=(start.date(),end.date()) if kind=="sales" else (start,end)
    return db.query(model).filter(model.company_id==company,getattr(model,field)>=first,getattr(model,field)<last,model.currency_snapshot.isnot(None)).order_by(model.id).yield_per(500)


def invoice_snapshot(db,id):return db.scalar(select(Invoice.currency_snapshot).where(Invoice.id==id))


def exchange_difference(db,company,start,end):
    from sqlalchemy import func
    return db.query(func.coalesce(func.sum(CustomerPaymentAllocation.exchange_difference_eur),0)).join(CustomerPayment,CustomerPayment.id==CustomerPaymentAllocation.payment_id).filter(
        CustomerPayment.company_id==company,CustomerPayment.status=="received",CustomerPayment.received_at>=start,CustomerPayment.received_at<end).scalar()
