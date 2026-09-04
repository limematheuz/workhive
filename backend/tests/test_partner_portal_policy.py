from fastapi import HTTPException

from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.company_membership import CompanyMembership
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.role import Role
from app.models.user import User
from app.services import entitlement_service, partner_portal_policy


def _company(db, suffix: str, *, plan: str, subscription_status: str) -> Company:
    company = Company(
        name=f"Partner portal {suffix}",
        tax_id=f"PARTNER-PORTAL-{suffix}",
        address="Calle del portal 1",
        phone="600000000",
        email=f"partner-portal-{suffix}@example.test",
        subscription_plan=plan,
        subscription_status=subscription_status,
    )
    db.add(company)
    db.flush()
    return company


def _grant(db, *, suffix: str = "PRIMARY", status: str = "active"):
    host = _company(db, f"HOST-{suffix}", plan="top", subscription_status="active")
    partner = _company(
        db,
        f"PARTNER-{suffix}",
        plan="none",
        subscription_status="inactive",
    )
    collaboration = CompanyCollaboration(
        initiator_company_id=host.id,
        partner_company_id=partner.id,
        status="accepted",
        role_type="property_manager",
    )
    role = db.query(Role).filter(Role.name == "partner_portal").one()
    user = User(
        email=f"partner-user-{suffix}@example.test",
        hashed_password="not-used",
        full_name="Partner user",
        role_id=role.id,
        company_id=partner.id,
    )
    db.add_all([collaboration, user])
    db.flush()
    grant = PartnerPortalGrant(
        host_company_id=host.id,
        partner_company_id=partner.id,
        collaboration_id=collaboration.id,
        user_id=user.id,
        status=status,
    )
    db.add(grant)
    db.commit()
    db.refresh(user)
    return host, partner, collaboration, user, grant


def test_sponsored_partner_portal_authorizes_a_nonpaying_property_manager(db):
    host, partner, _, user, grant = _grant(db)

    resolved = partner_portal_policy.require_active_partner_portal(
        db,
        current_user=user,
    )

    assert resolved.id == grant.id
    assert resolved.host_company_id == host.id
    assert resolved.partner_company_id == partner.id
    assert (
        db.query(CompanyMembership)
        .filter(CompanyMembership.user_id == user.id)
        .count()
        == 0
    )


def test_partner_portal_fails_closed_when_grant_is_revoked_or_mismatched(db):
    host, partner, collaboration, user, grant = _grant(db, suffix="REVOKED")
    grant.status = "revoked"
    db.commit()

    try:
        partner_portal_policy.require_active_partner_portal(db, current_user=user)
    except HTTPException as error:
        assert error.status_code == 403
    else:  # pragma: no cover - keeps the policy failure obvious
        raise AssertionError("Revoked portal grant was accepted")

    grant.status = "active"
    grant.host_company_id = partner.id
    db.commit()
    try:
        partner_portal_policy.require_active_partner_portal(db, current_user=user)
    except HTTPException as error:
        assert error.status_code == 403
    else:  # pragma: no cover
        raise AssertionError("Mismatched collaboration grant was accepted")

    assert collaboration.status == "accepted"
    assert host.id != partner.id


def test_partner_portal_capacity_is_host_scoped_and_does_not_consume_a_member_seat(db):
    host, partner, collaboration, user, _ = _grant(db, suffix="QUOTA")
    second_role = db.query(Role).filter(Role.name == "partner_portal").one()
    second_user = User(
        email="partner-user-second@example.test",
        hashed_password="not-used",
        full_name="Second partner user",
        role_id=second_role.id,
        company_id=partner.id,
    )
    db.add(second_user)
    db.flush()
    db.add(
        PartnerPortalGrant(
            host_company_id=host.id,
            partner_company_id=partner.id,
            collaboration_id=collaboration.id,
            user_id=second_user.id,
            status="active",
        )
    )
    db.commit()

    try:
        entitlement_service.require_partner_portal_capacity(
            db,
            company_id=host.id,
        )
    except HTTPException as error:
        assert error.status_code == 409
        assert error.headers["X-WorkHive-Error-Code"] == "entitlement.quota_reached"
    else:  # pragma: no cover
        raise AssertionError("Partner portal capacity was not enforced")
