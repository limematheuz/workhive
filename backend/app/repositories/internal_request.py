from sqlalchemy.orm import selectinload
from app.models.workflow_approval import PurchaseBudgetLink
from app.models.internal_request import InternalRequest


def rows(db,company):
    return db.query(InternalRequest).options(selectinload(InternalRequest.purchase_links).selectinload(PurchaseBudgetLink.approval)).filter_by(company_id=company)
