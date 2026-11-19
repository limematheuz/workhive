"""Owned application relationships, loaded in batches before building choices."""
from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from app.models.advisory_access import AdvisoryAccess
from app.models.client_portal_grant import ClientPortalGrant
from app.models.company import Company
from app.models.external_access_grant import ExternalAccessGrant
from app.models.role import Role
from app.models.staff_account import StaffAccount
from app.models.staff_employee import StaffEmployee


def client_grants(db, user_id, now):
    return db.query(ClientPortalGrant).options(selectinload(ClientPortalGrant.company), selectinload(ClientPortalGrant.client)).filter(
        ClientPortalGrant.user_id == user_id, ClientPortalGrant.status == "active",
        or_(ClientPortalGrant.expires_at.is_(None), ClientPortalGrant.expires_at > now),
    ).order_by(ClientPortalGrant.id).populate_existing().all()


def adviser_grants(db, user_id, now):
    return db.query(ExternalAccessGrant, Company, AdvisoryAccess).join(Company, Company.id == ExternalAccessGrant.company_id).outerjoin(
        AdvisoryAccess, AdvisoryAccess.grant_id == ExternalAccessGrant.id,
    ).filter(ExternalAccessGrant.user_id == user_id, ExternalAccessGrant.access_type == "accountant",
        ExternalAccessGrant.status == "active", or_(ExternalAccessGrant.expires_at.is_(None), ExternalAccessGrant.expires_at > now),
    ).order_by(ExternalAccessGrant.id).populate_existing().all()


def worker_companies(db, user_id):
    return {company for company, profile in db.query(StaffAccount.company_id, StaffEmployee.profile).join(
        StaffEmployee, StaffEmployee.id == StaffAccount.employee_id,
    ).filter(StaffAccount.user_id == user_id, StaffEmployee.company_id == StaffAccount.company_id).all()
        if (profile or {}).get("state") != "Baja"}


def client_grant(db, user_id, grant_id, now):
    return db.query(ClientPortalGrant).options(selectinload(ClientPortalGrant.company), selectinload(ClientPortalGrant.client)).filter(
        ClientPortalGrant.id == grant_id, ClientPortalGrant.user_id == user_id, ClientPortalGrant.status == "active",
        or_(ClientPortalGrant.expires_at.is_(None), ClientPortalGrant.expires_at > now),
    ).populate_existing().one_or_none()


def adviser_grant(db, user_id, grant_id, now):
    return db.query(ExternalAccessGrant, Company, AdvisoryAccess).join(Company, Company.id == ExternalAccessGrant.company_id).outerjoin(
        AdvisoryAccess, AdvisoryAccess.grant_id == ExternalAccessGrant.id,
    ).filter(ExternalAccessGrant.id == grant_id, ExternalAccessGrant.user_id == user_id,
        ExternalAccessGrant.access_type == "accountant", ExternalAccessGrant.status == "active",
        or_(ExternalAccessGrant.expires_at.is_(None), ExternalAccessGrant.expires_at > now),
    ).populate_existing().one_or_none()


def role(db, name):
    return db.query(Role).filter_by(name=name).one_or_none()


def epoch_grant(db, grant_id):
    return db.get(ExternalAccessGrant, grant_id)
