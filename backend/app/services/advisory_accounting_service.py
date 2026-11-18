from fastapi import HTTPException
from app.repositories import advisory_accounting as repo
from app.services.advisory_service import require_area
from app.services.accountant_export_service import resolve_export_period
from app.services import invoice_service,expense_receipt_service


def read(db,user,company,month,offset):
    require_area(db,user,company,"accounting")
    try:
        year,number=map(int,month.split("-"))
        period=resolve_export_period(year=year,period="month",period_number=number)
    except (ValueError,OverflowError):raise HTTPException(422,"Selecciona un mes válido.")
    invoices,expenses=repo.records(db,company,period.start,period.end,offset)
    base=f"/api/v1/advisory-accounting/{company}"
    return dict(invoices=[dict(id=i.id,number=i.invoice_number,date=i.issue_date,status=i.status,total=i.total_amount,pdf=f"{base}/invoices/{i.id}/pdf") for i in invoices[:100]],
        expenses=[dict(id=e.id,date=e.expense_date,vendor=e.vendor,description=e.description,total=e.total_amount,
            receipt=f"{base}/expenses/{e.id}/receipt" if e.receipt_url and e.receipt_url.startswith('private-expense-receipt:') else e.receipt_url if e.receipt_url and e.receipt_url.startswith("https://") else None) for e in expenses[:100]],
        has_more=len(invoices)>100 or len(expenses)>100)


def invoice_pdf(db,user,company,record_id):
    require_area(db,user,company,"accounting")
    return invoice_service.get_invoice_pdf(db,company,record_id)


def expense_receipt(db,user,company,record_id):
    require_area(db,user,company,"accounting")
    return expense_receipt_service.download_authorized_receipt(db,company_id=company,expense_id=record_id)
