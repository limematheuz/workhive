from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models.location import Location
from app.models.audit_log import AuditLog
from app.models.company_membership import Team
from app.models.work_session import WorkSession
from app.repositories import labor_cost as labor_cost_repo
from app.services import organization_bootstrap_service
from app.services.labor_cost_snapshot_service import refresh_work_session_labor_cost
from tests.test_client_permission_authorization import _bootstrap_admin, _company, _headers, _user


def test_labor_costs_are_admin_only_and_snapshot_closed_work(client, db):
    company = _company(db, "labor-cost")
    admin = _bootstrap_admin(db, company, "labor-cost-admin")
    worker = _user(db, company, "labor-cost-worker", role_id=3)
    manager = _user(db, company, "labor-cost-manager", role_id=2)
    admin.email = "labor-cost-admin@example.com"
    manager.email = "labor-cost-manager@example.com"
    worker_membership = organization_bootstrap_service.ensure_user_membership(db, worker)
    organization_bootstrap_service.ensure_user_membership(db, manager)
    db.commit()
    assert worker_membership is not None

    ended_at = datetime.now(timezone.utc)
    effective_on = ended_at.date()
    created = client.post(
        "/api/v1/labor-costs/rates",
        headers=_headers(admin),
        json={
            "company_membership_id": worker_membership.id,
            "hourly_cost": "25.00",
            "effective_on": effective_on.isoformat(),
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["member_name"] == worker.full_name
    assert created.json()["hourly_cost"] == "25.00"
    admin_identity = client.get("/api/v1/users/me", headers=_headers(admin))
    assert admin_identity.status_code == 200, admin_identity.text
    assert admin_identity.json()["can_view_labor_costs"] is True
    assert admin_identity.json()["can_manage_labor_costs"] is True
    audit_event = (
        db.query(AuditLog)
        .filter(AuditLog.action == "labor_cost_rate.created")
        .one()
    )
    assert audit_event.entity_id == str(created.json()["id"])
    assert audit_event.details == {
        "company_membership_id": worker_membership.id,
        "effective_on": effective_on.isoformat(),
    }

    rates = client.get("/api/v1/labor-costs/rates", headers=_headers(admin))
    assert rates.status_code == 200, rates.text
    assert [item["id"] for item in rates.json()] == [created.json()["id"]]
    assert client.get(
        "/api/v1/labor-costs/rates", headers=_headers(manager)
    ).status_code == 403
    manager_identity = client.get("/api/v1/users/me", headers=_headers(manager))
    assert manager_identity.status_code == 200, manager_identity.text
    assert manager_identity.json()["can_view_labor_costs"] is False
    assert manager_identity.json()["can_manage_labor_costs"] is False
    assert client.post(
        "/api/v1/labor-costs/rates",
        headers=_headers(manager),
        json={
            "company_membership_id": worker_membership.id,
            "hourly_cost": "30.00",
            "effective_on": (date.today() + timedelta(days=1)).isoformat(),
        },
    ).status_code == 403

    reserved_profile = client.post(
        "/api/v1/organization/permission-profiles",
        headers=_headers(admin),
        json={
            "name": "Costes personalizados",
            "permission_codes": ["labor_costs.read"],
        },
    )
    assert reserved_profile.status_code == 409, reserved_profile.text

    team = Team(company_id=company.id, name="Equipo Centro", code="CENTRO")
    db.add(team)
    db.flush()
    location = Location(
        name="Centro de coste",
        address="Calle de pruebas 1",
        city="Madrid",
        managing_company_id=company.id,
        owner_company_id=company.id,
        team_id=team.id,
    )
    db.add(location)
    db.flush()
    session = WorkSession(
        user_id=worker.id,
        location_id=location.id,
        start_time=ended_at - timedelta(hours=1),
        end_time=ended_at,
        paused_seconds=900,
    )
    db.add(session)
    db.flush()
    assert labor_cost_repo.get_effective_rate(
        db,
        company_id=company.id,
        company_membership_id=worker_membership.id,
        effective_on=effective_on,
    ) is not None
    refresh_work_session_labor_cost(db, work_session=session, company_id=company.id)
    db.commit()
    db.refresh(session)

    assert session.labor_cost_company_id == company.id
    assert session.labor_cost_membership_id == worker_membership.id
    assert session.labor_cost_rate_snapshot == Decimal("25.00")
    assert session.labor_cost_amount_snapshot == Decimal("18.75")
    assert session.labor_cost_team_id == team.id
    assert session.labor_cost_team_name_snapshot == "Equipo Centro"
    assert session.labor_cost_team_snapshotted_at is not None
    assert session.labor_cost_team_snapshotted_at.replace(tzinfo=timezone.utc) == ended_at
    team.name = "Equipo renombrado"
    location.team_id = None
    refresh_work_session_labor_cost(db, work_session=session, company_id=company.id)
    assert session.labor_cost_team_id == team.id
    assert session.labor_cost_team_name_snapshot == "Equipo Centro"
    assert not hasattr(session, "salary")

    summary = client.get("/api/v1/labor-costs/summary", headers=_headers(admin))
    assert summary.status_code == 200, summary.text
    assert summary.json() == [
        {
            "user_id": worker.id,
            "member_name": worker.full_name,
            "session_count": 1,
            "total_cost": "18.75",
        }
    ]


def test_labor_cost_rate_history_does_not_overwrite_existing_snapshot(client, db):
    company = _company(db, "labor-cost-history")
    admin = _bootstrap_admin(db, company, "labor-cost-history-admin")
    worker = _user(db, company, "labor-cost-history-worker", role_id=3)
    membership = organization_bootstrap_service.ensure_user_membership(db, worker)
    db.commit()
    assert membership is not None

    first = client.post(
        "/api/v1/labor-costs/rates",
        headers=_headers(admin),
        json={
            "company_membership_id": membership.id,
            "hourly_cost": "20.00",
            "effective_on": "2026-01-01",
        },
    )
    assert first.status_code == 201, first.text
    conflict = client.post(
        "/api/v1/labor-costs/rates",
        headers=_headers(admin),
        json={
            "company_membership_id": membership.id,
            "hourly_cost": "22.00",
            "effective_on": "2026-01-01",
        },
    )
    assert conflict.status_code == 409
    second = client.post(
        "/api/v1/labor-costs/rates",
        headers=_headers(admin),
        json={
            "company_membership_id": membership.id,
            "hourly_cost": "30.00",
            "effective_on": "2026-02-01",
        },
    )
    assert second.status_code == 201, second.text

    location = Location(
        name="Histórico",
        address="Calle de pruebas 2",
        city="Madrid",
        managing_company_id=company.id,
        owner_company_id=company.id,
    )
    db.add(location)
    db.flush()
    session = WorkSession(
        user_id=worker.id,
        location_id=location.id,
        start_time=datetime(2026, 1, 15, 8, tzinfo=timezone.utc),
        end_time=datetime(2026, 1, 15, 9, tzinfo=timezone.utc),
    )
    db.add(session)
    db.flush()
    refresh_work_session_labor_cost(db, work_session=session, company_id=company.id)
    db.commit()
    db.refresh(session)

    assert session.labor_cost_rate_snapshot == Decimal("20.00")
    assert session.labor_cost_amount_snapshot == Decimal("20.00")
