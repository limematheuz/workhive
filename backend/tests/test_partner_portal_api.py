from datetime import datetime, timedelta, timezone

import pytest

from app.core.security import create_access_token
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.company_membership import CompanyMembership
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.partner_portal_grant import PartnerPortalGrant
from app.models.reservation import Reservation
from app.models.role import Role
from app.models.user import User
from app.models.task_item import TaskItem


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


def _location_payload() -> dict:
    return {
        "name": "Apartamento creado en portal",
        "address": "Calle Nueva 12",
        "city": "Girona",
        "postal_code": "17001",
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

    # The identity endpoint remains available so the frontend can route this
    # session to the dedicated portal. It does not grant tenant access.
    me = client.get("/api/v1/users/me", headers=context["partner_headers"])
    assert me.status_code == 200, me.text
    assert me.json()["role"]["name"] == "partner_portal"

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


def test_partner_portal_creates_a_partner_property_shared_only_with_its_host(client, db):
    context = _portal_context(db, suffix="PROPERTY-CREATE")

    created = client.post(
        "/api/v1/partner-portal/locations",
        headers=context["partner_headers"],
        json=_location_payload(),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["owner_company_id"] == context["partner"].id
    assert body["managing_company_id"] == context["partner"].id
    assert body["default_service_provider_id"] == context["host"].id
    assert body["shared_companies"] == [context["host"].id]

    access = db.query(LocationCompanyAccess).filter(
        LocationCompanyAccess.location_id == body["id"],
        LocationCompanyAccess.company_id == context["host"].id,
    ).one()
    assert access.relationship_type == "default_service_provider"
    assert access.can_manage_tasks is True
    assert access.can_manage_reservations is False
    assert access.can_view_sensitive is False

    # The special endpoint does not make the non-paying collaborator eligible
    # for the generic internal workspace API.
    assert client.post(
        "/api/v1/locations/",
        headers=context["partner_headers"],
        json=_location_payload(),
    ).status_code == 402
    assert client.post(
        "/api/v1/partner-portal/locations",
        headers=context["partner_headers"],
        json={**_location_payload(), "owner_company_id": context["host"].id},
    ).status_code == 422


def test_partner_portal_can_manage_its_property_without_changing_provider(client, db):
    context = _portal_context(db, suffix="PROPERTY-MANAGE")
    property_id = context["location"].id

    catalog = client.get(
        "/api/v1/partner-portal/location-catalog",
        headers=context["partner_headers"],
    )
    assert catalog.status_code == 200, catalog.text
    assert any(site_type["id"] == "tourist_apartment" for site_type in catalog.json()["site_types"])

    suggestions = client.post(
        "/api/v1/partner-portal/location-space-suggestions",
        headers=context["partner_headers"],
        json={"site_type": "tourist_apartment", "attributes": {"bedroom_count": 1}},
    )
    assert suggestions.status_code == 200, suggestions.text
    assert suggestions.json()["spaces"]

    updated = client.patch(
        f"/api/v1/partner-portal/locations/{property_id}",
        headers=context["partner_headers"],
        json={
            "name": "Apartamento actualizado",
            "profile": {
                "site_type": "tourist_apartment",
                "contact_name": "Recepción",
                "attributes": {"bedroom_count": 2},
            },
            "access": {"access_method": "Conserjería", "permitted_days": ["mon"]},
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Apartamento actualizado"
    # Editing legacy data must not silently assign a provider or change sharing.
    assert updated.json()["default_service_provider_id"] is None
    assert updated.json()["profile"]["contact_name"] == "Recepción"

    # The route rejects ownership, provider, client, and organization changes.
    forbidden = client.patch(
        f"/api/v1/partner-portal/locations/{property_id}",
        headers=context["partner_headers"],
        json={"default_service_provider_id": context["partner"].id},
    )
    assert forbidden.status_code == 422

    deleted = client.delete(
        f"/api/v1/partner-portal/locations/{property_id}",
        headers=context["partner_headers"],
    )
    assert deleted.status_code == 204, deleted.text
    db.refresh(context["location"])
    assert context["location"].is_active is False


def test_complete_portal_property_round_trip_preserves_provider_and_secrets(client, db):
    context = _portal_context(db, suffix="FULL-PROPERTY")
    payload = {
        **_location_payload(),
        "profile": {"site_type": "tourist_apartment", "contact_email": "reception@example.test", "attributes": {"bedroom_count": 2}},
        "contacts": [{"full_name": "Recepción", "phone": "600 222 333", "role": "access", "is_primary": True}],
        "risks": [{"title": "Llaves en portería", "severity": "medium", "mitigation_notes": "Solicitarlas en recepción."}],
        "service_windows": [{"days": ["mon", "wed"], "starts_at": "10:00", "ends_at": "12:00"}],
        "access": {"permitted_days": ["mon"], "access_method": "key_box", "keys_available": False, "access_code": "e2e-door-code"},
        "spaces": [{"name": "Dormitorio", "space_type": "bedroom", "tasks": [{"title": "Limpiar suelo", "category": "cleaning"}]}],
    }
    created = client.post("/api/v1/partner-portal/locations", headers=context["partner_headers"], json=payload)
    assert created.status_code == 201, created.text
    property_id = created.json()["id"]
    assert created.json()["contacts"][0]["role"] == "access"
    assert created.json()["risks"][0]["title"] == "Llaves en portería"
    assert created.json()["service_windows"][0]["starts_at"] == "10:00"
    assert created.json()["access"]["has_access_code"] is True
    assert "e2e-door-code" not in created.text
    location = db.get(Location, property_id)
    assert len(location.zones) == 1
    assert len(location.zones[0].task_templates) == 1
    assert location.access_profile.access_code_encrypted != "e2e-door-code"
    shared_before = [(entry.company_id, entry.can_manage_tasks, entry.can_view_sensitive) for entry in location.company_access]
    updated = client.patch(f"/api/v1/partner-portal/locations/{property_id}", headers=context["partner_headers"], json={
        "profile": {"site_type": "tourist_apartment", "contact_email": None},
        "contacts": [{"id": created.json()["contacts"][0]["id"], "full_name": "Conserjería", "phone": "600 333 444", "role": "operations", "is_primary": True}],
        "risks": [{"id": created.json()["risks"][0]["id"], "title": "Llaves en portería", "severity": "medium", "status": "mitigated", "mitigation_notes": "Código entregado al equipo."}],
        "service_windows": [{"id": created.json()["service_windows"][0]["id"], "days": ["mon", "wed"], "starts_at": "09:00", "ends_at": "12:00"}],
        "access": {"permitted_days": [], "access_method": None, "clear_access_code": True},
    })
    assert updated.status_code == 200, updated.text
    assert updated.json()["default_service_provider_id"] == context["host"].id
    assert updated.json()["profile"]["contact_email"] is None
    assert updated.json()["contacts"][0]["full_name"] == "Conserjería"
    assert updated.json()["risks"][0]["status"] == "mitigated"
    assert updated.json()["service_windows"][0]["starts_at"] == "09:00"
    assert updated.json()["access"]["has_access_code"] is False
    assert updated.json()["access"]["access_method"] is None
    db.refresh(location)
    assert len(location.zones) == 1
    assert [(entry.company_id, entry.can_manage_tasks, entry.can_view_sensitive) for entry in location.company_access] == shared_before


@pytest.mark.parametrize("field", ["name", "address", "city", "owner_company_id", "client_id", "department_id", "team_id"])
def test_portal_property_rejects_null_identity_and_internal_assignments(client, db, field):
    context = _portal_context(db, suffix="INVALID-PROPERTY")
    response = client.patch(f"/api/v1/partner-portal/locations/{context['location'].id}", headers=context["partner_headers"], json={field: None})
    assert response.status_code == 422
    db.refresh(context["location"])
    assert context["location"].name == "Apartamento portal"


def test_portal_mutations_are_isolated_and_revocable(client, db):
    first = _portal_context(db, suffix="FIRST")
    other = _portal_context(db, suffix="SECOND")
    created = client.post("/api/v1/partner-portal/reservations", headers=other["partner_headers"], json=_reservation_payload(other["location"].id))
    assert created.status_code == 201, created.text
    paths = [f"locations/{other['location'].id}", f"reservations/{created.json()['id']}"]
    for path in paths:
        assert client.patch(f"/api/v1/partner-portal/{path}", headers=first["partner_headers"], json={}).status_code == 404
        assert client.delete(f"/api/v1/partner-portal/{path}", headers=first["partner_headers"]).status_code == 404
    other["grant"].status = "revoked"
    db.commit()
    for path in paths:
        assert client.patch(f"/api/v1/partner-portal/{path}", headers=other["partner_headers"], json={}).status_code == 403
        assert client.delete(f"/api/v1/partner-portal/{path}", headers=other["partner_headers"]).status_code == 403


def test_portal_can_edit_and_delete_its_unstarted_request(client, db):
    context = _portal_context(db, suffix="EDIT-REQUEST")
    payload = {**_reservation_payload(context["location"].id), "status": "tentative", "stay_type": "owner", "source": "manual"}
    created = client.post("/api/v1/partner-portal/reservations", headers=context["partner_headers"], json=payload)
    assert created.status_code == 201, created.text
    path = f"/api/v1/partner-portal/reservations/{created.json()['id']}"
    updated = client.patch(path, headers=context["partner_headers"], json={"notes": "Recoger las llaves", "guest_count": 4})
    assert updated.status_code == 200, updated.text
    assert updated.json()["guest_count"] == 4
    for field in ("status", "stay_type", "source"):
        assert updated.json()[field] == payload[field]
    assert updated.json()["assigned_company_id"] == context["host"].id
    assert client.delete(path, headers=context["partner_headers"]).status_code == 204
    assert db.get(Reservation, created.json()["id"]) is None


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


@pytest.mark.parametrize("task_status,invoiced", [("in_progress", False), ("completed", False), ("pending", True)])
def test_portal_cannot_destroy_or_reschedule_started_or_billed_work(client, db, task_status, invoiced):
    context = _portal_context(db, suffix="PROTECTED-WORK")
    created = client.post("/api/v1/partner-portal/reservations", headers=context["partner_headers"], json=_reservation_payload(context["location"].id))
    assert created.status_code == 201, created.text
    reservation_id = created.json()["id"]
    task = TaskItem(title="Protected cleaning", company_id=context["host"].id, location_id=context["location"].id,
                    checkout_reservation_id=reservation_id, status=task_status, is_invoiced=invoiced, unit="service", price=0, quantity=1)
    db.add(task)
    db.commit()
    path = f"/api/v1/partner-portal/reservations/{reservation_id}"
    assert client.patch(path, headers=context["partner_headers"], json={"guest_count": 8}).status_code == 409
    assert client.delete(path, headers=context["partner_headers"]).status_code == 409
    assert db.get(Reservation, reservation_id) is not None
    assert db.get(TaskItem, task.id) is not None


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
    assert granted.json()["user_email"] == internal_user.email
    refreshed_candidates = client.get(
        f"/api/v1/partner-portal/collaborations/{context['collaboration'].id}/candidates",
        headers=context["host_headers"],
    )
    assert refreshed_candidates.status_code == 200, refreshed_candidates.text
    assert not any(
        candidate["id"] == internal_user.id and candidate["eligible"]
        for candidate in refreshed_candidates.json()
    )
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

    listed = client.get(
        f"/api/v1/partner-portal/collaborations/{context['collaboration'].id}/grants",
        headers=context["host_headers"],
    )
    assert listed.status_code == 200, listed.text
    assert internal_user.id in {grant["user_id"] for grant in listed.json()}

    revoked = client.delete(
        f"/api/v1/partner-portal/collaborations/{context['collaboration'].id}/grants/{granted.json()['id']}",
        headers=context["host_headers"],
    )
    assert revoked.status_code == 200, revoked.text
    assert revoked.json()["status"] == "revoked"


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
