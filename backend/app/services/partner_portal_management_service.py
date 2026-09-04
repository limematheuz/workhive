"""Host-side management of sponsored property-manager portal access."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company_membership import CompanyMembership
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.user import User
from app.repositories import company_collaboration as collaboration_repo
from app.repositories import partner_portal as partner_portal_repo
from app.repositories import role as role_repo
from app.repositories import user as user_repo
from app.services.entitlement_service import (
    require_company_feature,
    require_partner_portal_capacity,
)
from app.services.partner_portal_policy import (
    PARTNER_PORTAL_FEATURE_CODE,
    PARTNER_PORTAL_ROLE_NAME,
    collaboration_companies,
)
from app.services.subscription_policy import evaluate_company_access


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _require_host_collaboration(db: Session, *, host_user: User, collaboration_id: int):
    collaboration = collaboration_repo.get_collaboration_by_id(db, collaboration_id)
    if collaboration is None or collaboration.status != "accepted":
        raise HTTPException(status_code=404, detail="Accepted collaboration not found")
    host_company_id, partner_company_id = collaboration_companies(collaboration)
    if host_user.company_id != host_company_id:
        raise HTTPException(status_code=404, detail="Accepted collaboration not found")
    require_company_feature(
        db,
        company_id=host_company_id,
        code=PARTNER_PORTAL_FEATURE_CODE,
    )
    return collaboration, host_company_id, partner_company_id


def list_portal_candidates(
    db: Session,
    *,
    host_user: User,
    collaboration_id: int,
) -> list[dict]:
    _, _, partner_company_id = _require_host_collaboration(
        db,
        host_user=host_user,
        collaboration_id=collaboration_id,
    )
    candidates = user_repo.get_company_members(db, partner_company_id)
    active_user_ids = {
        user_id
        for (user_id,) in db.query(PartnerPortalGrant.user_id)
        .filter(
            PartnerPortalGrant.collaboration_id == collaboration_id,
            PartnerPortalGrant.status == "active",
        )
        .all()
    }
    response: list[dict] = []
    for candidate in candidates:
        role_name = candidate.role.name if candidate.role else ""
        is_supported_role = role_name in {
            "admin",
            "manager",
            "viewer",
            PARTNER_PORTAL_ROLE_NAME,
        }
        already_active = candidate.id in active_user_ids
        eligible = candidate.is_active and is_supported_role and not already_active
        response.append(
            {
                "id": candidate.id,
                "full_name": candidate.full_name,
                "email": candidate.email,
                "role_name": role_name,
                "eligible": eligible,
                "ineligible_reason": (
                    None
                    if eligible
                else (
                    "This person already has an active portal access."
                    if already_active
                    else "Only active internal partner users can be converted to the portal."
                )
                ),
            }
        )
    return response


def serialize_portal_grant(grant: PartnerPortalGrant) -> dict:
    return {
        "id": grant.id,
        "host_company_id": grant.host_company_id,
        "partner_company_id": grant.partner_company_id,
        "collaboration_id": grant.collaboration_id,
        "user_id": grant.user_id,
        "status": grant.status,
        "expires_at": grant.expires_at,
        "created_at": grant.created_at,
        "revoked_at": grant.revoked_at,
        "user_full_name": grant.user.full_name if grant.user else None,
        "user_email": grant.user.email if grant.user else None,
    }


def list_portal_grants(
    db: Session,
    *,
    host_user: User,
    collaboration_id: int,
) -> list[dict]:
    _require_host_collaboration(
        db,
        host_user=host_user,
        collaboration_id=collaboration_id,
    )
    grants = (
        db.query(PartnerPortalGrant)
        .filter(
            PartnerPortalGrant.collaboration_id == collaboration_id,
            PartnerPortalGrant.status == "active",
        )
        .order_by(PartnerPortalGrant.created_at.asc(), PartnerPortalGrant.id.asc())
        .all()
    )
    return [serialize_portal_grant(grant) for grant in grants]


def grant_portal_access(
    db: Session,
    *,
    host_user: User,
    collaboration_id: int,
    partner_user_id: int,
) -> PartnerPortalGrant:
    collaboration, host_company_id, partner_company_id = _require_host_collaboration(
        db,
        host_user=host_user,
        collaboration_id=collaboration_id,
    )
    partner_user = user_repo.get_user_by_id(db, partner_user_id)
    if (
        partner_user is None
        or not partner_user.is_active
        or partner_user.company_id != partner_company_id
        or not partner_user.role
        or partner_user.role.name
        not in {"admin", "manager", "viewer", PARTNER_PORTAL_ROLE_NAME}
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select an active user from the collaborating property manager.",
        )
    if evaluate_company_access(partner_user.company).allowed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A paying collaborator keeps its full workspace and cannot use the sponsored portal.",
        )
    active_grant = partner_portal_repo.get_active_grant_for_user(
        db,
        user_id=partner_user.id,
        now=_utcnow(),
    )
    if active_grant and active_grant.collaboration_id != collaboration.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This person already has an active sponsored partner portal.",
        )
    grant = partner_portal_repo.get_grant_for_collaboration_user(
        db,
        collaboration_id=collaboration.id,
        user_id=partner_user.id,
    )
    if grant is None or grant.status != "active":
        require_partner_portal_capacity(db, company_id=host_company_id)
    partner_portal_role = role_repo.get_role_by_name(db, PARTNER_PORTAL_ROLE_NAME)
    if partner_portal_role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Partner portal role is not configured.",
        )
    now = _utcnow()
    if grant is None:
        grant = PartnerPortalGrant(
            host_company_id=host_company_id,
            partner_company_id=partner_company_id,
            collaboration_id=collaboration.id,
            user_id=partner_user.id,
            status="active",
            granted_by_user_id=host_user.id,
        )
        db.add(grant)
    else:
        grant.host_company_id = host_company_id
        grant.partner_company_id = partner_company_id
        grant.status = "active"
        grant.expires_at = None
        grant.revoked_at = None
        grant.revoked_by_user_id = None
        grant.granted_by_user_id = host_user.id
        db.add(grant)
    (
        db.query(CompanyMembership)
        .filter(
            CompanyMembership.company_id == partner_company_id,
            CompanyMembership.user_id == partner_user.id,
            CompanyMembership.status == "active",
        )
        .update(
            {
                CompanyMembership.status: "archived",
                CompanyMembership.ended_at: now,
            },
            synchronize_session=False,
        )
    )
    partner_user.role_id = partner_portal_role.id
    partner_user.session_version += 1
    db.add(partner_user)
    db.commit()
    db.refresh(grant)
    return grant


def revoke_portal_access(
    db: Session,
    *,
    host_user: User,
    collaboration_id: int,
    grant_id: int,
) -> PartnerPortalGrant:
    _require_host_collaboration(
        db,
        host_user=host_user,
        collaboration_id=collaboration_id,
    )
    grant = (
        db.query(PartnerPortalGrant)
        .filter(
            PartnerPortalGrant.id == grant_id,
            PartnerPortalGrant.collaboration_id == collaboration_id,
        )
        .first()
    )
    if grant is None:
        raise HTTPException(status_code=404, detail="Partner portal access not found")
    grant.status = "revoked"
    grant.revoked_at = _utcnow()
    grant.revoked_by_user_id = host_user.id
    if grant.user:
        grant.user.session_version += 1
        db.add(grant.user)
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return grant
