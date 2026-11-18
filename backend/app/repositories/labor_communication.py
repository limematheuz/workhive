from datetime import datetime,timezone
from sqlalchemy import or_
from app.models.labor_communication import LaborCommunication,LaborCommunicationEvent
from app.models.staff_employee import StaffEmployee
from app.models.external_access_grant import ExternalAccessGrant
from app.models.advisory_access import AdvisoryAccess
from app.models.user import User
from app.models.document_register import DocumentRevision,RegisteredDocument


def recipients(db,company):
    now=datetime.now(timezone.utc)
    return db.query(User).join(ExternalAccessGrant,ExternalAccessGrant.user_id==User.id).join(AdvisoryAccess,AdvisoryAccess.grant_id==ExternalAccessGrant.id).filter(ExternalAccessGrant.company_id==company,ExternalAccessGrant.access_type=="accountant",ExternalAccessGrant.status=="active",or_(ExternalAccessGrant.expires_at.is_(None),ExternalAccessGrant.expires_at>now),AdvisoryAccess.payroll.is_(True),User.is_active.is_(True)).order_by(User.full_name,User.id).all()


def employees(db,company):return db.query(StaffEmployee).filter_by(company_id=company).order_by(StaffEmployee.name).all()


def rows(db,company,user_id=None):
    query=db.query(LaborCommunication).filter_by(company_id=company)
    return query.filter_by(recipient_user_id=user_id) if user_id else query


def record(db,company,id,user_id=None):return rows(db,company,user_id).filter(LaborCommunication.id==id).populate_existing().with_for_update().first()


def events(db,ids):
    return db.query(LaborCommunicationEvent,User.full_name).join(User,User.id==LaborCommunicationEvent.actor_user_id).filter(LaborCommunicationEvent.communication_id.in_(ids)).order_by(LaborCommunicationEvent.id).all() if ids else []


def documents(db,company,ids):
    return db.query(DocumentRevision,RegisteredDocument).join(RegisteredDocument,RegisteredDocument.id==DocumentRevision.document_id).filter(RegisteredDocument.company_id==company,DocumentRevision.id.in_(ids)).all() if ids else []
