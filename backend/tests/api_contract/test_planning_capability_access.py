from datetime import datetime, timedelta, timezone

import pytest

from app.models.location import Location
from app.models.reservation import Reservation
from app.services.company_entitlement_service import synchronize_company_subscription
from test_client_permission_authorization import _assign_company_profile


@pytest.mark.parametrize("scope", ["company", "location"])
def test_an_explicit_operational_profile_can_read_only_its_managed_planning_scope(client, db, api_workspace, scope):
    qa = api_workspace
    other = Location(name="QA readonly", address="QA", city="Madrid", owner_company_id=qa.company.id, managing_company_id=qa.company.id)
    db.add(other); db.flush()
    _assign_company_profile(db, company=qa.company, admin=qa.admin, user=qa.worker,
        name="QA locations read", permission_codes={"locations.read"})
    _assign_company_profile(db, company=qa.company, admin=qa.admin, user=qa.worker,
        name="QA scoped operation", permission_codes={"work.read", "work.manage"},
        scope_type=scope, scope_id=qa.company.id if scope == "company" else qa.location.id)
    now = datetime.now(timezone.utc)
    reservations = []
    for location in [qa.location, other]:
        reservation = Reservation(owner_company_id=qa.company.id, location_id=location.id,
            check_in_at=now + timedelta(hours=1), check_out_at=now + timedelta(days=1),
            guest_count=2, status="confirmed", source="manual", cleaning_required=True)
        db.add(reservation); db.flush(); reservations.append(reservation)
    db.commit()
    for route in ["/api/v1/reservations/", "/api/v1/reservations/upcoming/arrivals"]:
        response = client.get(route, headers=qa.headers["worker"])
        assert response.status_code == 200, response.text
        assert {row["id"] for row in response.json()} == {r.id for r in reservations[:2 if scope == "company" else 1]}


@pytest.mark.parametrize("plan,planning", [("basic", False), ("medium", True)])
def test_location_action_hints_include_the_planning_entitlement(client, db, api_workspace, plan, planning):
    qa = api_workspace
    qa.company.subscription_plan = plan
    synchronize_company_subscription(db, qa.company, reason="test.plan-hints")
    db.commit()
    response = client.get("/api/v1/locations/", headers=qa.headers["admin"])
    assert response.status_code == 200
    assert response.json()[0]["can_manage_reservations"] is planning
    assert response.json()[0]["can_manage_tasks"] is True
