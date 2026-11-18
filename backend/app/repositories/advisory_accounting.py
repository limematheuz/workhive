from app.models.invoice import Invoice
from app.models.expense import Expense


def records(db,company,start,end,offset):
    invoices=db.query(Invoice).filter(Invoice.company_id==company,Invoice.status!="draft",Invoice.issue_date>=start,Invoice.issue_date<end).order_by(Invoice.id).offset(offset).limit(101).all()
    expenses=db.query(Expense).filter(Expense.company_id==company,Expense.is_active.is_(True),Expense.expense_date>=start,Expense.expense_date<end).order_by(Expense.id).offset(offset).limit(101).all()
    return invoices,expenses
