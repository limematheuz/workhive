from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import event

from app.models.location import Location
from app.models.labor_cost_rate import LaborCostRate
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from app.repositories import work_session as work_session_repo
from app.repositories import work_session_correction as correction_repo
from app.schemas.work_session_correction import (
    WorkSessionCorrectionCreate,
    WorkSessionCorrectionReview,
)
from app.services import work_session_correction_service
from app.services import organization_bootstrap_service
from app.services.labor_cost_snapshot_service import refresh_work_session_labor_cost
from tests.test_service_contracts import _authenticated_company, _client, _location
from tests.test_work_operations import _company, _user


def _closed_session(db, *, worker, company, task=None) -> WorkSession:
    location = Location(
        name="Ubicación de corrección",
        address="Calle de Pruebas 5",
        city="Girona",
        managing_company_id=company.id,
        owner_company_id=company.id,
    )
    db.add(location)
    db.flush()
    started_at = datetime.now(timezone.utc) - timedelta(hours=4)
    session = WorkSession(
        user_id=worker.id,
        location_id=location.id,
        task_item_id=task.id if task else None,
        start_time=started_at,
        end_time=started_at + timedelta(hours=2),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _request_data(session: WorkSession) -> WorkSessionCorrectionCreate:
    return WorkSessionCorrectionCreate(
        requested_start_time=session.start_time - timedelta(minutes=30),
        requested_end_time=session.end_time + timedelta(minutes=30),
        reason="Olvidé registrar la entrada y la salida reales.",
    )


def test_manager_approval_preserves_history_and_refreshes_completed_snapshot(db):
    company = _company(db, "Correcciones")
    manager = _user(db, company, "manager-corrections@example.com", role_id=2)
    worker = _user(db, company, "worker-corrections@example.com", role_id=3)
    location = Location(
        name="Ubicación facturable",
        address="Calle de Pruebas 6",
        city="Girona",
        managing_company_id=company.id,
        owner_company_id=company.id,
    )
    db.add(location)
    db.flush()
    task = TaskItem(
        title="Trabajo corregible",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        status="completed",
        worked_seconds_snapshot=7_200,
    )
    db.add(task)
    db.flush()
    started_at = datetime.now(timezone.utc) - timedelta(hours=4)
    session = WorkSession(
        user_id=worker.id,
        location_id=location.id,
        task_item_id=task.id,
        start_time=started_at,
        end_time=started_at + timedelta(hours=2),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    membership = organization_bootstrap_service.ensure_user_membership(db, worker)
    assert membership is not None
    db.add(
        LaborCostRate(
            company_id=company.id,
            company_membership_id=membership.id,
            hourly_cost=Decimal("20.00"),
            effective_on=session.end_time.date(),
            created_by_user_id=manager.id,
        )
    )
    db.flush()
    refresh_work_session_labor_cost(db, work_session=session, company_id=company.id)
    db.commit()
    db.refresh(session)
    assert session.labor_cost_amount_snapshot == Decimal("40.00")

    correction = work_session_correction_service.request_correction(
        db,
        worker,
        session.id,
        _request_data(session),
    )

    assert correction.status == "pending"
    assert correction.original_start_time == session.start_time
    assert correction.original_end_time == session.end_time
    assert work_session_correction_service.list_corrections(db, worker) == [correction]
    assert work_session_correction_service.list_corrections(
        db, manager, review_queue=True
    ) == [correction]

    reviewed = work_session_correction_service.review_correction(
        db,
        manager,
        correction.id,
        WorkSessionCorrectionReview(decision="approved", note="Horario confirmado."),
    )
    db.refresh(session)
    db.refresh(task)

    assert reviewed.status == "approved"
    assert reviewed.reviewed_by_user_id == manager.id
    assert reviewed.applied_at is not None
    assert session.start_time == correction.requested_start_time
    assert session.end_time == correction.requested_end_time
    assert task.worked_seconds_snapshot == 10_800
    assert session.labor_cost_amount_snapshot == Decimal("60.00")


def test_worker_cannot_duplicate_or_approve_own_pending_correction(db):
    company = _company(db, "Duplicados")
    worker = _user(db, company, "worker-duplicates@example.com", role_id=3)
    session = _closed_session(db, worker=worker, company=company)
    correction = work_session_correction_service.request_correction(
        db,
        worker,
        session.id,
        _request_data(session),
    )

    with pytest.raises(HTTPException) as duplicate:
        work_session_correction_service.request_correction(
            db,
            worker,
            session.id,
            _request_data(session),
        )
    assert duplicate.value.status_code == 409

    with pytest.raises(HTTPException) as self_review:
        work_session_correction_service.review_correction(
            db,
            worker,
            correction.id,
            WorkSessionCorrectionReview(decision="approved"),
        )
    assert self_review.value.status_code == 403


def test_locked_session_lookup_does_not_join_nullable_location(db):
    company = _company(db, "Correcciones con bloqueo")
    worker = _user(db, company, "worker-lock-corrections@example.com", role_id=3)
    session = _closed_session(db, worker=worker, company=company)
    statements: list[str] = []

    def capture_statement(_connection, _cursor, statement, _parameters, _context, _executemany):
        if "FROM work_sessions" in statement:
            statements.append(statement)

    event.listen(db.bind, "before_cursor_execute", capture_statement)
    try:
        locked = work_session_repo.get_work_session_by_id(
            db,
            session.id,
            worker.id,
            for_update=True,
        )
    finally:
        event.remove(db.bind, "before_cursor_execute", capture_statement)

    assert locked is not None
    assert statements
    assert all("JOIN locations" not in statement.upper() for statement in statements)


def test_locked_correction_lookup_does_not_join_nullable_relationships(db):
    company = _company(db, "Correcciones bloqueadas")
    worker = _user(db, company, "worker-locked-correction@example.com", role_id=3)
    session = _closed_session(db, worker=worker, company=company)
    correction = work_session_correction_service.request_correction(
        db,
        worker,
        session.id,
        _request_data(session),
    )
    statements: list[str] = []

    def capture_statement(_connection, _cursor, statement, _parameters, _context, _executemany):
        if "FROM work_session_corrections" in statement:
            statements.append(statement)

    event.listen(db.bind, "before_cursor_execute", capture_statement)
    try:
        locked = correction_repo.get_correction(
            db,
            company_id=company.id,
            correction_id=correction.id,
            for_update=True,
        )
    finally:
        event.remove(db.bind, "before_cursor_execute", capture_statement)

    assert locked is not None
    assert statements
    assert all("JOIN" not in statement.upper() for statement in statements)


def test_corrections_are_isolated_and_invoiced_time_is_immutable(db):
    company = _company(db, "Aislada")
    outsider_company = _company(db, "Ajena")
    manager = _user(db, company, "manager-isolated@example.com", role_id=2)
    worker = _user(db, company, "worker-isolated@example.com", role_id=3)
    outsider = _user(db, outsider_company, "outsider-isolated@example.com")
    session = _closed_session(db, worker=worker, company=company)
    correction = work_session_correction_service.request_correction(
        db,
        worker,
        session.id,
        _request_data(session),
    )

    with pytest.raises(HTTPException) as isolated:
        work_session_correction_service.review_correction(
            db,
            outsider,
            correction.id,
            WorkSessionCorrectionReview(decision="approved"),
        )
    assert isolated.value.status_code == 404

    location = Location(
        name="Ubicación cerrada",
        address="Calle de Pruebas 7",
        city="Girona",
        managing_company_id=company.id,
        owner_company_id=company.id,
    )
    db.add(location)
    db.flush()
    billed_task = TaskItem(
        title="Trabajo facturado",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        is_invoiced=True,
    )
    db.add(billed_task)
    db.flush()
    billed_session = WorkSession(
        user_id=worker.id,
        location_id=location.id,
        task_item_id=billed_task.id,
        start_time=datetime.now(timezone.utc) - timedelta(hours=2),
        end_time=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(billed_session)
    db.commit()
    db.refresh(billed_session)

    with pytest.raises(HTTPException) as invoiced:
        work_session_correction_service.request_correction(
            db,
            worker,
            billed_session.id,
            _request_data(billed_session),
        )
    assert invoiced.value.status_code == 409
    assert work_session_correction_service.list_corrections(
        db, manager, review_queue=True
    ) == [correction]


def test_correction_api_exposes_only_the_requesters_history(client, db):
    headers = _authenticated_company(
        client,
        email="correction-api@example.com",
        name="Correcciones API",
        tax_id="B10000081",
    )
    customer = _client(client, headers, name="Cliente de corrección")
    location = _location(client, headers, customer["id"])
    current_user = client.get("/api/v1/users/me", headers=headers)
    assert current_user.status_code == 200, current_user.text
    assert current_user.json()["can_manage_time"] is True
    assert current_user.json()["can_approve_time"] is True
    user = db.query(User).filter(User.email == "correction-api@example.com").one()
    session = WorkSession(
        user_id=user.id,
        location_id=location["id"],
        start_time=datetime.now(timezone.utc) - timedelta(hours=3),
        end_time=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    created = client.post(
        f"/api/v1/work-session-corrections/sessions/{session.id}",
        headers=headers,
        json={
            "requested_start_time": (
                session.start_time - timedelta(minutes=15)
            ).isoformat(),
            "requested_end_time": (
                session.end_time + timedelta(minutes=15)
            ).isoformat(),
            "reason": "El registro inicial se hizo unos minutos tarde.",
        },
    )
    assert created.status_code == 201, created.text

    own_history = client.get("/api/v1/work-session-corrections/", headers=headers)
    assert own_history.status_code == 200, own_history.text
    assert [item["id"] for item in own_history.json()] == [created.json()["id"]]
    assert own_history.json()[0]["status"] == "pending"
    assert own_history.json()[0]["requester_name"] == "Correcciones API"
    assert own_history.json()[0]["location_name"] == location["name"]
