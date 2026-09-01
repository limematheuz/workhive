from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.company import Company
from app.models.location import Location
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from app.schemas.task_item import TaskItemCreate, TaskItemUpdate
from app.services import (
    reservation_service,
    task_assignment_service,
    task_item_service,
    user_service,
    work_session_service,
)

START_LATITUDE = 41.3851
START_LONGITUDE = 2.1734
START_ACCURACY_METERS = 8.0


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-TEST",
        address="Calle Test 1",
        phone="600000000",
        email=f"{name.lower()}@test.com",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(db, company: Company, email: str, role_id: int = 1) -> User:
    user = User(
        email=email,
        hashed_password="unused",
        full_name=email.split("@")[0],
        role_id=role_id,
        company_id=company.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _start_task_work(db, user: User, task_id: int, notes: str | None = None):
    return task_item_service.start_task_work(
        db,
        user,
        task_id,
        notes,
        START_LATITUDE,
        START_LONGITUDE,
        START_ACCURACY_METERS,
    )


def test_live_work_visibility_follows_dispatched_reservation_tasks(db):
    issuer = _company(db, "IssuerLive")
    provider = _company(db, "ProviderLive")
    unrelated = _company(db, "UnrelatedLive")
    issuer_admin = _user(db, issuer, "issuer-admin@live.test")
    issuer_worker = _user(db, issuer, "issuer-worker@live.test", role_id=3)
    provider_admin = _user(db, provider, "provider-admin@live.test")
    provider_worker = _user(db, provider, "provider-worker@live.test", role_id=3)
    unrelated_admin = _user(db, unrelated, "unrelated-admin@live.test")
    unrelated_worker = _user(db, unrelated, "unrelated-worker@live.test", role_id=3)
    issuer_location = Location(
        name="Issuer dispatched location",
        address="Calle Live 1",
        city="Madrid",
        owner_company_id=issuer.id,
        managing_company_id=issuer.id,
    )
    provider_location = Location(
        name="Provider private location",
        address="Calle Live 2",
        city="Madrid",
        owner_company_id=provider.id,
        managing_company_id=provider.id,
    )
    unrelated_location = Location(
        name="Unrelated location",
        address="Calle Live 3",
        city="Madrid",
        owner_company_id=unrelated.id,
        managing_company_id=unrelated.id,
    )
    db.add_all([issuer_location, provider_location, unrelated_location])
    db.flush()
    reservation = Reservation(
        location_id=issuer_location.id,
        owner_company_id=issuer.id,
        assigned_company_id=provider.id,
        check_in_at=datetime.now(timezone.utc) + timedelta(days=2),
        check_out_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(reservation)
    db.flush()
    dispatched_task = TaskItem(
        title="Dispatched cleaning",
        unit="service",
        company_id=provider.id,
        location_id=issuer_location.id,
        user_id=provider_admin.id,
        checkout_reservation_id=reservation.id,
        status="progress",
    )
    provider_private_task = TaskItem(
        title="Provider private task",
        unit="service",
        company_id=provider.id,
        location_id=provider_location.id,
        user_id=provider_worker.id,
        status="progress",
    )
    db.add_all([dispatched_task, provider_private_task])
    db.flush()
    db.add_all(
        [
            WorkSession(
                user_id=issuer_worker.id,
                location_id=issuer_location.id,
                start_time=datetime.now(timezone.utc) - timedelta(minutes=10),
            ),
            WorkSession(
                user_id=provider_admin.id,
                location_id=issuer_location.id,
                task_item_id=dispatched_task.id,
                start_time=datetime.now(timezone.utc) - timedelta(minutes=20),
            ),
            WorkSession(
                user_id=provider_worker.id,
                location_id=provider_location.id,
                task_item_id=provider_private_task.id,
                start_time=datetime.now(timezone.utc) - timedelta(minutes=30),
            ),
            WorkSession(
                user_id=unrelated_worker.id,
                location_id=unrelated_location.id,
                start_time=datetime.now(timezone.utc) - timedelta(minutes=40),
            ),
        ]
    )
    db.commit()

    issuer_sessions = work_session_service.get_active_company_sessions(
        db, issuer_admin
    )
    provider_sessions = work_session_service.get_active_company_sessions(
        db, provider_admin
    )
    unrelated_sessions = work_session_service.get_active_company_sessions(
        db, unrelated_admin
    )

    assert {session.user_id for session in issuer_sessions} == {
        issuer_worker.id,
        provider_admin.id,
    }
    assert {
        session.user_id: session.visibility_scope
        for session in issuer_sessions
    } == {
        issuer_worker.id: "own",
        provider_admin.id: "collaborator",
    }
    assert {session.user_id for session in provider_sessions} == {
        provider_admin.id,
        provider_worker.id,
    }
    assert all(
        session.visibility_scope == "own"
        for session in provider_sessions
    )
    assert [session.user_id for session in unrelated_sessions] == [
        unrelated_worker.id
    ]


def test_completed_task_status_wins_over_stale_worker_assignment(db):
    company = _company(db, "CompletedStatus")
    worker = _user(db, company, "viewer-completed@test.test", role_id=3)
    location = Location(
        name="Casa completada",
        address="Calle Final 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Limpieza completada",
        description=f"- [ ] Limpiar suelo (@{worker.id}:viewer:accepted)",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        status="completed",
    )

    assert task_assignment_service.get_user_assignment_status(
        task, worker.id
    ) == "completed"


def test_task_summary_sums_three_workers_as_nine_hours_without_client(db):
    company = _company(db, "Ownet")
    admin = _user(db, company, "admin@ownet.test")
    worker = _user(db, company, "worker@ownet.test")
    second_worker = _user(db, company, "worker2@ownet.test")
    location = Location(
        name="Casa sin cliente",
        address="Calle Test 2",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Limpieza",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=worker.id,
    )
    db.add(task)
    db.commit()

    start = datetime.now(timezone.utc) - timedelta(hours=10)
    db.add_all(
        [
            WorkSession(
                user_id=admin.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=start,
                end_time=start + timedelta(hours=3),
            ),
            WorkSession(
                user_id=worker.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=start + timedelta(hours=3),
                end_time=start + timedelta(hours=6),
            ),
            WorkSession(
                user_id=second_worker.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=start + timedelta(hours=6),
                end_time=start + timedelta(hours=9),
            ),
        ]
    )
    db.commit()

    summary = work_session_service.get_task_work_summary(db, admin, task.id)

    assert summary.total_seconds == 9 * 60 * 60
    assert summary.session_count == 3
    assert summary.active_workers == 0


def test_task_detailed_summary_desgloses_workers(db):
    company = _company(db, "DetailedOwnet")
    admin = _user(db, company, "admin_detailed@ownet.test")
    worker = _user(db, company, "worker_detailed@ownet.test")
    second_worker = _user(db, company, "worker2_detailed@ownet.test")
    location = Location(
        name="Casa detailed sin cliente",
        address="Calle Detailed Test 2",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Limpieza Detallada",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=worker.id,
    )
    db.add(task)
    db.commit()

    start = datetime.now(timezone.utc) - timedelta(hours=10)
    db.add_all(
        [
            WorkSession(
                user_id=admin.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=start,
                end_time=start + timedelta(hours=3),
            ),
            WorkSession(
                user_id=worker.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=start + timedelta(hours=3),
                end_time=start + timedelta(hours=6),
            ),
            WorkSession(
                user_id=second_worker.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=start + timedelta(hours=6),
                end_time=start + timedelta(hours=9),
            ),
            WorkSession(
                user_id=second_worker.id,
                location_id=location.id,
                task_item_id=task.id,
                start_time=datetime.now(timezone.utc) - timedelta(minutes=30),
                end_time=None,
            ),
        ]
    )
    db.commit()

    summary = work_session_service.get_task_work_detailed_summary(db, admin, task.id)

    assert summary.total_seconds >= 9.5 * 60 * 60
    assert summary.session_count == 4
    assert summary.active_workers == 1

    workers_dict = {w.user_id: w for w in summary.workers}
    assert admin.id in workers_dict
    assert worker.id in workers_dict
    assert second_worker.id in workers_dict

    assert workers_dict[admin.id].total_seconds == 3 * 60 * 60
    assert workers_dict[admin.id].is_active is False
    assert workers_dict[worker.id].total_seconds == 3 * 60 * 60
    assert workers_dict[worker.id].is_active is False

    assert workers_dict[second_worker.id].total_seconds >= 3.5 * 60 * 60
    assert workers_dict[second_worker.id].is_active is True


def test_task_detailed_summaries_batches_visible_tasks(db):
    company = _company(db, "BatchDetailed")
    admin = _user(db, company, "admin_batch_detailed@ownet.test")
    location = Location(
        name="Casa batch detailed",
        address="Calle Batch 2",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.flush()
    first_task = TaskItem(
        title="Primera tarea",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=admin.id,
    )
    second_task = TaskItem(
        title="Segunda tarea",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=admin.id,
    )
    db.add_all([first_task, second_task])
    db.flush()
    start = datetime.now(timezone.utc) - timedelta(hours=2)
    db.add_all(
        [
            WorkSession(
                user_id=admin.id,
                location_id=location.id,
                task_item_id=first_task.id,
                start_time=start,
                end_time=start + timedelta(hours=1),
            ),
            WorkSession(
                user_id=admin.id,
                location_id=location.id,
                task_item_id=second_task.id,
                start_time=start + timedelta(hours=1),
                end_time=start + timedelta(hours=2),
            ),
        ]
    )
    db.commit()

    summaries = work_session_service.get_task_work_detailed_summaries(
        db,
        admin,
        [second_task.id, first_task.id, 999999],
    )

    assert [summary.task_item_id for summary in summaries] == [first_task.id, second_task.id]
    assert all(summary.session_count == 1 for summary in summaries)
    assert all(summary.total_seconds == 60 * 60 for summary in summaries)


def test_viewers_start_accepted_work_and_finish_only_their_assigned_work(db):
    company = _company(db, "FieldTeam")
    manager = _user(db, company, "manager@field.test", role_id=2)
    first_worker = _user(db, company, "first@field.test", role_id=3)
    second_worker = _user(db, company, "second@field.test", role_id=3)
    location = Location(
        name="Casa compartida",
        address="Calle Trabajo 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Limpieza distribuida",
        description=(
            f"[ ] Limpiar cocina (@{first_worker.id}:Primera:pending)\n"
            f"[ ] Limpiar baños (@{second_worker.id}:Segunda:pending)"
        ),
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=manager.id,
        status="accepted",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    started = _start_task_work(
        db, first_worker, task.id, "Inicio desde móvil"
    )

    assert started.status == "progress"
    assert task_assignment_service.get_user_assignment_status(
        started, first_worker.id
    ) == "progress"
    active = work_session_service.get_active_session(db, first_worker.id)
    assert active is not None
    assert active.task_item_id == task.id
    assert active.location_id == location.id
    assert active.start_latitude == START_LATITUDE
    assert active.start_longitude == START_LONGITUDE
    assert active.start_accuracy_meters == START_ACCURACY_METERS
    detailed_summary = work_session_service.get_task_work_detailed_summary(
        db, manager, task.id
    )
    assert len(detailed_summary.start_locations) == 1
    assert detailed_summary.start_locations[0].latitude == START_LATITUDE
    assert detailed_summary.start_locations[0].longitude == START_LONGITUDE

    checked_description = started.description.replace(
        "[ ] Limpiar cocina", "[x] Limpiar cocina"
    )
    updated = task_item_service.update_task_item(
        db,
        first_worker,
        task.id,
        TaskItemUpdate(description=checked_description),
    )
    finished_first = task_item_service.finish_task_work(
        db, first_worker, task.id
    )

    assert updated.id == task.id
    assert finished_first.status == "progress"
    assert work_session_service.get_active_session(db, first_worker.id) is None
    assert task_assignment_service.get_user_assignment_status(
        finished_first, first_worker.id
    ) == "completed"
    assert task_assignment_service.get_user_assignment_status(
        finished_first, second_worker.id
    ) == "pending"

    started_second = _start_task_work(db, second_worker, task.id)
    second_checked_description = started_second.description.replace(
        "[ ] Limpiar baños", "[x] Limpiar baños"
    )
    task_item_service.update_task_item(
        db,
        second_worker,
        task.id,
        TaskItemUpdate(description=second_checked_description),
    )
    finished_second = task_item_service.finish_task_work(
        db, second_worker, task.id
    )

    assert finished_second.status == "completed"
    assert finished_second.date_done is not None
    assert work_session_service.get_active_session(db, second_worker.id) is None


def test_start_work_repairs_an_existing_session_and_task_status(db):
    company = _company(db, "Repair")
    manager = _user(db, company, "manager@repair.test", role_id=2)
    worker = _user(db, company, "viewer@repair.test", role_id=3)
    location = Location(
        name="Casa sesión antigua",
        address="Calle Sesion 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Trabajo desfasado",
        description=f"[ ] Revisar casa (@{worker.id}:Viewer:pending)",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=manager.id,
        status="accepted",
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    db.add(
        WorkSession(
            user_id=worker.id,
            location_id=location.id,
            task_item_id=task.id,
            start_time=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
    )
    db.commit()

    repaired = _start_task_work(db, worker, task.id)

    assert repaired.status == "progress"
    assert task_assignment_service.get_user_assignment_status(
        repaired, worker.id
    ) == "progress"
    assert len(
        [
            session
            for session in db.query(WorkSession).all()
            if session.user_id == worker.id and session.end_time is None
        ]
    ) == 1


def test_manual_clock_out_resets_unfinished_viewer_assignment_to_pending(db):
    company = _company(db, "ClockOut")
    manager = _user(db, company, "manager@clockout.test", role_id=2)
    worker = _user(db, company, "viewer@clockout.test", role_id=3)
    location = Location(
        name="Casa cronometro",
        address="Calle Crono 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Trabajo sin terminar",
        description=f"[ ] Limpiar entrada (@{worker.id}:Viewer:pending)",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=manager.id,
        status="accepted",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    started = _start_task_work(db, worker, task.id)
    assert started.status == "progress"
    assert task_assignment_service.get_user_assignment_status(
        started, worker.id
    ) == "progress"

    closed_session = work_session_service.end_work_session(db, worker.id)
    db.refresh(task)

    assert closed_session.end_time is not None
    assert task.status == "accepted"
    assert task_assignment_service.get_user_assignment_status(
        task, worker.id
    ) == "pending"
    assert work_session_service.get_active_session(db, worker.id) is None


def test_clock_out_and_resume_preserve_worker_and_external_task_time(db):
    issuer = _company(db, "IssuerLedger")
    provider = _company(db, "ProviderLedger")
    outsider = _company(db, "OutsiderLedger")
    issuer_admin = _user(db, issuer, "issuer-admin@ledger.test")
    provider_admin = _user(db, provider, "provider-admin@ledger.test")
    worker = _user(db, provider, "worker@ledger.test", role_id=3)
    outsider_admin = _user(db, outsider, "outsider-admin@ledger.test")
    location = Location(
        name="Casa con reserva",
        address="Calle Registro 1",
        city="Girona",
        owner_company_id=issuer.id,
        managing_company_id=issuer.id,
    )
    db.add(location)
    db.flush()
    reservation = Reservation(
        location_id=location.id,
        owner_company_id=issuer.id,
        assigned_company_id=provider.id,
        check_in_at=datetime.now(timezone.utc) + timedelta(days=1),
        check_out_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    db.add(reservation)
    db.flush()
    task = TaskItem(
        title="Limpieza enviada por inmobiliaria",
        description=f"[ ] Limpiar entrada (@{worker.id}:Trabajador:pending)",
        unit="servicio",
        company_id=provider.id,
        location_id=location.id,
        user_id=provider_admin.id,
        checkout_reservation_id=reservation.id,
        status="accepted",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    _start_task_work(db, worker, task.id, "Primer tramo")
    first_session = work_session_service.get_active_session(db, worker.id)
    assert first_session is not None
    first_session.start_time = datetime.now(timezone.utc) - timedelta(hours=2)
    db.commit()

    first_closed = work_session_service.end_work_session(db, worker.id)
    assert first_closed.end_time is not None
    db.refresh(task)
    assert task.status == "accepted"
    assert task_assignment_service.get_user_assignment_status(task, worker.id) == "pending"

    _start_task_work(db, worker, task.id, "Segundo tramo")
    second_session = work_session_service.get_active_session(db, worker.id)
    assert second_session is not None
    assert second_session.id != first_closed.id
    second_session.start_time = datetime.now(timezone.utc) - timedelta(hours=1)
    db.commit()

    second_closed = work_session_service.end_work_session(db, worker.id)
    assert second_closed.end_time is not None
    assert work_session_service.get_active_session(db, worker.id) is None

    expected_seconds = sum(
        int((session.end_time - session.start_time).total_seconds())
        for session in (first_closed, second_closed)
        if session.end_time is not None
    )
    worker_stats = user_service.get_user_stats(db, worker.id, provider_admin)
    provider_summary = work_session_service.get_task_work_detailed_summary(
        db, provider_admin, task.id
    )
    issuer_summary = work_session_service.get_task_work_detailed_summary(
        db, issuer_admin, task.id
    )

    assert provider_summary.session_count == 2
    assert issuer_summary.session_count == 2
    assert provider_summary.total_seconds == expected_seconds
    assert issuer_summary.total_seconds == expected_seconds
    assert worker_stats.total_hours_worked == round(expected_seconds / 3600, 2)
    assert [item.user_id for item in issuer_summary.workers] == [worker.id]

    with pytest.raises(HTTPException) as exc_info:
        work_session_service.get_task_work_detailed_summary(db, outsider_admin, task.id)
    assert exc_info.value.status_code == 404


def test_viewer_cannot_start_before_admin_accepts_task(db):
    company = _company(db, "AcceptanceGate")
    manager = _user(db, company, "manager@gate.test", role_id=2)
    worker = _user(db, company, "viewer@gate.test", role_id=3)
    location = Location(
        name="Casa validacion",
        address="Calle Validacion 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Trabajo por validar",
        description=f"[ ] Preparar entrada (@{worker.id}:Viewer:pending)",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=manager.id,
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    with pytest.raises(HTTPException) as exc_info:
        _start_task_work(db, worker, task.id)

    assert exc_info.value.status_code == 400

    accepted = task_item_service.update_task_item(
        db,
        manager,
        task.id,
        TaskItemUpdate(status="accepted"),
    )
    started = _start_task_work(db, worker, accepted.id)

    assert started.status == "progress"
    assert task_assignment_service.get_user_assignment_status(
        started, worker.id
    ) == "progress"


def test_viewer_cannot_see_or_start_accepted_unassigned_task(db):
    company = _company(db, "AssignmentGate")
    manager = _user(db, company, "manager@assignment.test", role_id=2)
    worker = _user(db, company, "viewer@assignment.test", role_id=3)
    location = Location(
        name="Casa sin reparto",
        address="Calle Reparto 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Trabajo aceptado sin reparto",
        description="[ ] Limpiar cocina",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=None,
        status="accepted",
        accepted_by_user_id=manager.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    assert task_assignment_service.can_viewer_access_task(task, worker.id) is False
    with pytest.raises(HTTPException) as exc_info:
        _start_task_work(db, worker, task.id)

    assert exc_info.value.status_code == 403


def test_manager_can_create_and_later_assign_a_task_without_placeholder(db):
    company = _company(db, "NullableAssignment")
    manager = _user(db, company, "manager@nullable.test", role_id=2)
    worker = _user(db, company, "worker@nullable.test", role_id=3)
    location = Location(
        name="Casa sin asignar",
        address="Calle Nullable 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()

    task = task_item_service.create_task_item(
        db,
        manager,
        TaskItemCreate(
            title="Trabajo pendiente de reparto",
            unit="servicio",
            location_id=location.id,
            user_id=None,
        ),
    )

    assert task.company_id == company.id
    assert task.user_id is None
    assert task_assignment_service.can_viewer_access_task(task, worker.id) is False

    assigned = task_item_service.update_task_item(
        db,
        manager,
        task.id,
        TaskItemUpdate(user_id=worker.id),
    )
    assert assigned.user_id == worker.id
    assert task_assignment_service.can_viewer_access_task(assigned, worker.id) is True


def test_start_preserves_assignments_when_freezing_live_checklist(db, monkeypatch):
    company = _company(db, "SnapshotAssignments")
    manager = _user(db, company, "manager@snapshot.test", role_id=2)
    worker = _user(db, company, "viewer@snapshot.test", role_id=3)
    location = Location(
        name="Casa checklist vivo",
        address="Calle Checklist 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Servicio externo aceptado",
        description=(
            "Instrucciones originales\n\n"
            f"- [ ] Limpiar cocina (@{worker.id}:viewer:accepted)\n"
            f"- [ ] Limpiar terraza (@{worker.id}:viewer:accepted)"
        ),
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=manager.id,
        status="accepted",
        accepted_by_user_id=manager.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    monkeypatch.setattr(
        reservation_service,
        "get_live_external_task_snapshot",
        lambda _db, _task: {
            "description": (
                "Instrucciones actualizadas\n\n"
                "- [ ] Limpiar terraza\n"
                "- [ ] Limpiar cocina\n"
                "- [ ] Revisar ventanas"
            )
        },
    )

    started = _start_task_work(db, worker, task.id)
    checklist = task_assignment_service.parse_checklist(started.description)

    assert started.status == "progress"
    assert [item.text for item in checklist] == [
        "Limpiar terraza",
        "Limpiar cocina",
        "Revisar ventanas",
    ]
    assert [item.assigned_user_id for item in checklist] == [
        worker.id,
        worker.id,
        None,
    ]
    assert task_assignment_service.get_user_assignment_status(
        started, worker.id
    ) == "progress"


def test_negative_checklist_answer_counts_as_completed_requirement(db):
    company = _company(db, "NegativeRequirement")
    manager = _user(db, company, "manager@negative.test", role_id=2)
    worker = _user(db, company, "viewer@negative.test", role_id=3)
    location = Location(
        name="Casa requisito negativo",
        address="Calle No 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Revisar requisito",
        description=f"[ ] ¿Hay desperfectos? (@{worker.id}:Viewer:pending)",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=manager.id,
        status="accepted",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    _start_task_work(db, worker, task.id)
    task_item_service.update_task_item(
        db,
        worker,
        task.id,
        TaskItemUpdate(checklist_evidence={"parsed_1": {"answer": "no"}}),
    )
    finished = task_item_service.finish_task_work(db, worker, task.id)

    assert finished.status == "completed"
    assert finished.date_done is not None
    assert work_session_service.get_active_session(db, worker.id) is None


def test_viewer_cannot_accept_by_updating_the_global_task_status(db):
    company = _company(db, "Permissions")
    manager = _user(db, company, "manager@permissions.test", role_id=2)
    worker = _user(db, company, "viewer@permissions.test", role_id=3)
    location = Location(
        name="Casa permisos",
        address="Calle Permisos 1",
        city="Girona",
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    task = TaskItem(
        title="Trabajo protegido",
        description=f"[ ] Ejecutar trabajo (@{worker.id}:Viewer:pending)",
        unit="servicio",
        company_id=company.id,
        location_id=location.id,
        user_id=manager.id,
        status="pending",
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    with pytest.raises(HTTPException) as exc_info:
        task_item_service.update_task_item(
            db,
            worker,
            task.id,
            TaskItemUpdate(status="accepted"),
        )

    assert exc_info.value.status_code == 403


def test_upcoming_arrival_is_visible_to_owner_and_assigned_company(db):
    issuer = _company(db, "Inmobiliaria")
    receiver = _company(db, "Limpiezas")
    # Upcoming arrivals belong to the paid Planning workflow.
    issuer.subscription_plan = "pro"
    receiver.subscription_plan = "pro"
    db.add_all([issuer, receiver])
    db.commit()
    issuer_admin = _user(db, issuer, "admin@inmo.test")
    receiver_admin = _user(db, receiver, "admin@clean.test")
    location = Location(
        name="Casa compartida",
        address="Calle Test 3",
        city="Girona",
        managing_company_id=issuer.id,
    )
    db.add(location)
    db.commit()
    check_in = datetime.now(timezone.utc) + timedelta(days=2)
    reservation = Reservation(
        location_id=location.id,
        owner_company_id=issuer.id,
        check_in_at=check_in,
        check_out_at=check_in + timedelta(days=3),
        guest_count=4,
    )
    db.add(reservation)
    db.commit()
    task = TaskItem(
        title="Limpieza salida",
        unit="servicio",
        company_id=receiver.id,
        location_id=location.id,
        user_id=receiver_admin.id,
        checkout_reservation_id=reservation.id,
        status="requested",
    )
    db.add(task)
    db.commit()

    issuer_arrivals = reservation_service.list_upcoming_arrivals(
        db, issuer_admin, days=3
    )
    receiver_arrivals = reservation_service.list_upcoming_arrivals(
        db, receiver_admin, days=3
    )

    assert [item.id for item in issuer_arrivals] == [reservation.id]
    assert [item.id for item in receiver_arrivals] == [reservation.id]
