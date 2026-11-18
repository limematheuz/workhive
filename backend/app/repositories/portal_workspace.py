from sqlalchemy import func, or_
from app.models.client import Client
from app.models.client_portal_grant import ClientPortalGrant
from app.models.client_portal_invitation import ClientPortalInvitation
from app.models.external_access_grant import ExternalAccessGrant
from app.models.advisory_access import AdvisoryAccess
from app.models.user import User

def clients(db, company, search, offset):
    query = db.query(Client.id, Client.name).filter(Client.company_id == company, Client.is_active.is_(True))
    if search:
        query = query.filter(Client.name.contains(search, autoescape=True))
    return query.order_by(Client.name, Client.id).offset(offset).limit(101).all()

def grants(db, company, ids):
    return db.query(ClientPortalGrant, User.email, User.full_name, User.is_active).join(User, User.id == ClientPortalGrant.user_id).filter(ClientPortalGrant.company_id == company, ClientPortalGrant.client_id.in_(ids)).order_by(ClientPortalGrant.id).all()

def invitations(db, company, ids):
    return db.query(ClientPortalInvitation).filter(ClientPortalInvitation.company_id == company, ClientPortalInvitation.client_id.in_(ids)).order_by(ClientPortalInvitation.id.desc()).all()

def accountant_grants(db, company):
    return db.query(ExternalAccessGrant, User.email, User.full_name, User.is_active, AdvisoryAccess).join(User, User.id == ExternalAccessGrant.user_id).outerjoin(AdvisoryAccess, AdvisoryAccess.grant_id == ExternalAccessGrant.id).filter(ExternalAccessGrant.company_id == company, ExternalAccessGrant.access_type == 'accountant').order_by(ExternalAccessGrant.id).all()

def totals(db, company, now):
    active_grants = db.query(func.count(ClientPortalGrant.id)).join(User, User.id == ClientPortalGrant.user_id).join(Client, (Client.id == ClientPortalGrant.client_id) & (Client.company_id == company)).filter(ClientPortalGrant.company_id == company, ClientPortalGrant.status == 'active', Client.is_active.is_(True), User.is_active.is_(True), or_(ClientPortalGrant.expires_at.is_(None), ClientPortalGrant.expires_at > now)).scalar()
    pending = db.query(func.count(ClientPortalInvitation.id)).join(Client, (Client.id == ClientPortalInvitation.client_id) & (Client.company_id == company)).filter(ClientPortalInvitation.company_id == company, Client.is_active.is_(True), ClientPortalInvitation.status == 'pending', ClientPortalInvitation.expires_at > now).scalar()
    return dict(active_client_accesses=active_grants, pending_invitations=pending)
