from datetime import datetime, timedelta, timezone

from app.core.security import create_access_token
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.company_membership import CompanyMembership
from app.models.location import Location
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.user import User


def _company(db, suffix: str, *, plan: str, subscription_status: str) -> Company:
    company = Company(
        name=f"Portal {suffix}",
        tax_id=f"PORTAL-{suffix}",
        address="Calle Portal 1",
        phone="600000000",
        email=f"portal-{suffix}@example.test",
        subscription_plan=plan,
        subscription_status=subscription_status,
    )
    db.add(company)
    db.flush()
    return company


def _user(db, *, suffix: str, company: Company, role_name: str) -> tuple[User, dict[str, str]]:
    role = db.query(Role).filter(Role.name == role_name).one()
    user = User(
        email=f"{suffix}@portal.example.com",
        hashed_password="not-used",
        full_name=suffix,
        company_id=company.id,
        role_id=role.id,
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return user, {"Authorization": f"Bearer {token}"}


def _portal_context(db, *, suffix: str = "PRIMARY"):
    host = _company(db, f"HOST-{suffix}", plan="top", subscription_status="active")
    partner = _company(
        db,
        f"PARTNER-{suffix}",
        plan="none",
        subscription_status="inactive",
    )
    host_admin, host_headers = _user(
        db,
        suffix=f"host-admin-{suffix}",
        company=host,
        role_name="admin",
    )
    partner_user, partner_headers = _user(
        db,
        suffix=f"partner-user-{suffix}",
        company=partner,
        role_name="partner_portal",
    )
    collaboration = CompanyCollaboration(
        initiator_company_id=host.id,
        partner_company_id=partner.id,
        status="accepted",
        role_type="property_manager",
    )
    db.add(collaboration)
    db.flush()
    grant = PartnerPortalGrant(
        host_company_id=host.id,
        partner_company_id=partner.id,
        collaboration_id=collaboration.id,
        user_id=partner_user.id,
        status="active",
        granted_by_user_id=host_admin.id,
    )
    location = Location(
        name="Apartamento portal",
        address="Calle Propiedad 1",
        city="Girona",
        owner_company_id=partner.id,
        managing_company_id=partner.id,
    )
    db.add_all([grant, location])
    db.commit()
    db.refresh(location)
    return {
        "host": host,
        "partner": partner,
        "host_admin": host_admin,
        "host_headers": host_headers,
        "partner_user": partner_user,
        "partner_headers": partner_headers,
        "collaboration": collaboration,
        "grant": grant,
        "location": location,
    }


def _reservation_payload(location_id: int) -> dict:
    check_in = datetime.now(timezone.utc) + timedelta(days=2)
    return {
        "location_id": location_id,
        "check_in_at": check_in.isoformat(),
        "check_out_at": (check_in + timedelta(days=3)).isoformat(),
        "guest_count": 3,
        "cleaning_required": True,
    }


def test_partner_portal_only_exposes_owned_properties_and_sponsored_reservations(client, db):
    context = _portal_context(db)
    other = _company(db, "OTHER", plan="top", subscription_status="active")
    other_location = Location(
        name="Otro apartamento",
        address="Calle Ajena 1",
        city="Girona",
        owner_company_id=other.id,
        managing_company_id=other.id,
    )
    db.add(other_location)
    db.commit()

    overview = client.get("/api/v1/partner-portal/overview", headers=context["partner_headers"])
    assert overview.status_code == 200, overview.text
    assert overview.json()["host_company_id"] == context["host"].id
    locations = client.get("/api/v1/partner-portal/locations", headers=context["partner_headers"])
    assert locations.status_code == 200, locations.text
    assert [location["id"] for location in locations.json()] == [context["location"].id]

    created = client.post(
        "/api/v1/partner-portal/reservations",
        headers=context["partner_headers"],
        json=_reservation_payload(context["location"].id),
    )
    assert created.status_code == 201, created.text
    created_body = created.json()
    assert created_body["owner_company_id"] == context["partner"].id
    assert created_body["assigned_company_id"] == context["host"].id
    assert created_body["service_request_sent_at"] is not None

    assert client.post(
        "/api/v1/partner-portal/reservations",
        headers=context["partner_headers"],
        json=_reservation_payload(other_location.id),
    ).status_code == 404
    assert client.get(
        f"/api/v1/partner-portal/reservations?location_id={other_location.id}",
        headers=context["partner_headers"],
    ).status_code == 404

    # Generic tenant endpoints remain blocked. The portal is not a member of
    # the property manager's non-paying workspace.
    assert client.get("/api/v1/reservations/", headers=context["partner_headers"]).status_code == 402
    assert client.get("/api/v1/invoices/", headers=context["partner_headers"]).status_code == 402


def test_partner_portal_cannot_change_provider_or_remove_cleaning_request(client, db):
    context = _portal_context(db, suffix="LOCKED")
    other_provider = _company(db, "OTHER-PROVIDER", plan="top", subscription_status="active")
    created = client.post(
        "/api/v1/partner-portal/reservations",
        headers=context["partner_headers"],
        json=_reservation_payload(context["location"].id),
    )
    assert created.status_code == 201, created.text

    provider_change = client.patch(
        f"/api/v1/partner-portal/reservations/{created.json()['id']}",
        headers=context["partner_headers"],
        json={"assigned_company_id": other_provider.id},
    )
    assert provider_change.status_code == 422
    cleaning_change = client.patch(
        f"/api/v1/partner-portal/reservations/{created.json()['id']}",
        headers=context["partner_headers"],
        json={"cleaning_required": False},
    )
    assert cleaning_change.status_code == 422


def test_revoked_partner_portal_grant_fails_closed(client, db):
    context = _portal_context(db, suffix="REVOKED")
    context["grant"].status = "revoked"
    db.commit()

    response = client.get("/api/v1/partner-portal/overview", headers=context["partner_headers"])
    assert response.status_code == 403


def test_host_admin_can_convert_a_nonpaying_partner_user_to_the_portal(client, db):
    context = _portal_context(db, suffix="CONVERT")
    portal_role = db.query(Role).filter(Role.name == "partner_portal").one()
    internal_user, _ = _user(
        db,
        suffix="convert-existing",
        company=context["partner"],
        role_name="admin",
    )
    membership = CompanyMembership(
        company_id=context["partner"].id,
        user_id=internal_user.id,
        access_class="admin",
        status="active",
    )
    db.add(membership)
    db.commit()

    candidates = client.get(
        f"/api/v1/partner-portal/collaborations/{context['collaboration'].id}/candidates",
        headers=context["host_headers"],
    )
    assert candidates.status_code == 200, candidates.text
    assert any(candidate["id"] == internal_user.id and candidate["eligible"] for candidate in candidates.json())

    granted = client.post(
        f"/api/v1/partner-portal/collaborations/{context['collaboration'].id}/grants",
        headers=context["host_headers"],
        json={"user_id": internal_user.id},
    )
    assert granted.status_code == 201, granted.text
    db.refresh(internal_user)
    db.refresh(membership)
    assert internal_user.role_id == portal_role.id
    assert membership.status == "archived"
    assert (
        db.query(PartnerPortalGrant)
        .filter(
            PartnerPortalGrant.user_id == internal_user.id,
            PartnerPortalGrant.status == "active",
        )
        .count()
        == 1
    )


def test_portal_is_bound_to_its_specific_collaboration(client, db):
    context = _portal_context(db, suffix="ISOLATION")
    other_host = _company(db, "SECOND-HOST", plan="top", subscription_status="active")
    other_collaboration = CompanyCollaboration(
        initiator_company_id=other_host.id,
        partner_company_id=context["partner"].id,
        status="accepted",
        role_type="property_manager",
    )
    db.add(other_collaboration)
    db.flush()
    db.add(
        Reservation(
            location_id=context["location"].id,
            owner_company_id=context["partner"].id,
            assigned_company_id=other_host.id,
            check_in_at=datetime.now(timezone.utc) + timedelta(days=20),
            check_out_at=datetime.now(timezone.utc) + timedelta(days=23),
            guest_count=2,
            cleaning_required=True,
        )
    )
    db.commit()

    reservations = client.get(
        "/api/v1/partner-portal/reservations",
        headers=context["partner_headers"],
    )
    assert reservations.status_code == 200, reservations.text
    assert all(
        reservation["assigned_company_id"] == context["host"].id
        for reservation in reservations.json()
    )
