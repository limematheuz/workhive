from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.models.client import Client
from app.models.calendar_sync_job import CalendarSyncJob
from app.models.company import Company
from app.models.company_collaboration import CompanyCollaboration
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.location_template import LocationTemplate
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.task_structure import TaskChecklistItem
from app.models.template_task import TemplateTask
from app.models.user import User
from app.models.work_session import WorkSession
from app.schemas.reservation import ReservationCreate, ReservationUpdate
from app.schemas.location import LocationUpdate
from app.schemas.task_item import (
    TaskAcceptRequest,
    TaskItemCreate,
    TaskItemResponse,
    TaskItemUpdate,
)
from app.schemas.template_task import TemplateTaskCreate, TemplateTaskUpdate
from app.services import (
    calendar_sync_service,
    collaboration_service,
    location_access_service,
    location_service,
    location_template_service,
    reservation_service,
    task_item_service,
    template_task_service,
)
from tests.test_client_permission_authorization import _headers


def _company(db, name: str, tax_id: str) -> Company:
    company = Company(
        name=name,
        tax_id=tax_id,
        address="Calle Test 1",
        phone="600000000",
        email=f"{tax_id.lower()}@test.com",
        # Reservation workflows are covered by the Planning entitlement.
        subscription_plan="pro",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(db, company: Company, role_id: int, email: str) -> User:
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


def _location(db, company: Company) -> Location:
    client = Client(
        name="Cliente",
        legal_number=f"C-{company.id}",
        address="Calle Test 1",
        city="Girona",
        postal_code="17001",
        country="España",
        phone="600000000",
        email=f"client-{company.id}@test.com",
        company_id=company.id,
    )
    db.add(client)
    db.commit()
    location = Location(
        name="Casa Anastasia",
        address="Calle Canigo 1",
        city="Girona",
        client_id=client.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def _reservation_data(location_id: int) -> ReservationCreate:
    check_in = datetime.now(timezone.utc) + timedelta(days=1)
    return ReservationCreate(
        location_id=location_id,
        check_in_at=check_in,
        check_out_at=check_in + timedelta(days=3),
        guest_count=5,
        cleaning_required=True,
    )


@pytest.mark.parametrize(
    ("task_status", "with_session"),
    [("progress", False), ("review", False), ("completed", False), ("accepted", True)],
)
def test_cancelling_reservation_preserves_started_work_and_its_sessions(
    db, task_status, with_session
):
    company = _company(db, "Preserved cleaning", f"PRESERVE{task_status}{with_session}")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email=f"admin-{task_status}-{with_session}@test.com")
    reservation = reservation_service.create_reservation(
        db, admin, _reservation_data(location.id)
    )
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation.id).one()
    task.status = task_status
    session_id = None
    if with_session:
        work_session = WorkSession(
            user_id=admin.id,
            location_id=location.id,
            task_item_id=task.id,
            start_time=datetime.now(timezone.utc),
        )
        db.add(work_session)
    db.commit()
    if with_session:
        session_id = work_session.id

    updated = reservation_service.update_reservation(
        db, admin, reservation.id, ReservationUpdate(status="cancelled")
    )

    db.expire_all()
    assert updated.status == "cancelled"
    preserved_task = db.get(TaskItem, task.id)
    assert preserved_task is not None
    assert preserved_task.checkout_reservation_id == reservation.id
    assert preserved_task.status == task_status
    if session_id is not None:
        assert db.get(WorkSession, session_id).task_item_id == task.id


def test_cancelling_reservation_removes_only_unstarted_work(db):
    company = _company(db, "Pending cleaning", "PENDINGCANCEL")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin-pending-cancel@test.com")
    reservation = reservation_service.create_reservation(
        db, admin, _reservation_data(location.id)
    )
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation.id).one()
    task_id = task.id

    updated = reservation_service.update_reservation(
        db, admin, reservation.id, ReservationUpdate(status="cancelled")
    )

    assert updated.status == "cancelled"
    assert db.get(TaskItem, task_id) is None


@pytest.mark.parametrize("activity", ["partial_checklist", "field_report"])
def test_cancelling_reservation_preserves_work_evidence_without_progress_status(db, activity):
    company = _company(db, "Recorded cleaning", f"RECORDED{activity}")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email=f"admin-{activity}@test.com")
    reservation = reservation_service.create_reservation(
        db, admin, _reservation_data(location.id)
    )
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation.id).one()
    assert task.status == "accepted"
    if activity == "partial_checklist":
        db.add(TaskChecklistItem(
            task_id=task.id,
            position=0,
            text="QA first step",
            completed=True,
        ))
    else:
        db.add(TaskReport(
            task_item_id=task.id,
            reporter_user_id=admin.id,
            reporter_company_id=company.id,
            client_event_id="reservation-cancel-evidence",
            report_type="note",
            reporter_name=admin.full_name,
            description="QA work already recorded",
        ))
    db.commit()

    reservation_service.update_reservation(
        db, admin, reservation.id, ReservationUpdate(status="cancelled")
    )

    db.expire_all()
    preserved_task = db.get(TaskItem, task.id)
    assert preserved_task is not None
    assert preserved_task.checkout_reservation_id == reservation.id
    if activity == "partial_checklist":
        assert preserved_task.checklist_items[0].completed is True
    else:
        assert db.query(TaskReport).filter_by(task_item_id=task.id).count() == 1


@pytest.mark.parametrize("operation", ["delete", "disable_cleaning"])
def test_started_work_cannot_be_removed_through_other_reservation_actions(db, operation):
    company = _company(db, "Protected cleaning", f"PROTECT{operation}")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email=f"admin-{operation}@test.com")
    reservation = reservation_service.create_reservation(
        db, admin, _reservation_data(location.id)
    )
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation.id).one()
    task.status = "completed"
    db.commit()

    with pytest.raises(HTTPException) as error:
        if operation == "delete":
            reservation_service.delete_reservation(db, admin, reservation.id)
        else:
            reservation_service.update_reservation(
                db, admin, reservation.id, ReservationUpdate(cleaning_required=False)
            )

    assert error.value.status_code == 409
    db.expire_all()
    assert db.get(TaskItem, task.id).checkout_reservation_id == reservation.id
    assert db.get(TaskItem, task.id).status == "completed"


def test_viewer_cannot_cancel_reservation_with_started_work(db):
    company = _company(db, "Protected booking", "PROTECTEDVIEWER")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin-protected-viewer@test.com")
    viewer = _user(db, company, role_id=3, email="viewer-protected@test.com")
    reservation = reservation_service.create_reservation(
        db, admin, _reservation_data(location.id)
    )
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation.id).one()
    task.status = "completed"
    db.commit()

    with pytest.raises(HTTPException) as error:
        reservation_service.update_reservation(
            db, viewer, reservation.id, ReservationUpdate(status="cancelled")
        )

    assert error.value.status_code == 403
    db.expire_all()
    assert reservation.status != "cancelled"
    assert db.get(TaskItem, task.id).checkout_reservation_id == reservation.id


def test_provider_change_cannot_discard_pending_task_with_field_report(db):
    company = _company(db, "Reported cleaning", "REPORTEDPROVIDER")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin-reported-provider@test.com")
    reservation = reservation_service.create_reservation(
        db, admin, _reservation_data(location.id)
    )
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation.id).one()
    task.status = "pending"
    db.add(TaskReport(
        task_item_id=task.id,
        reporter_user_id=admin.id,
        reporter_company_id=company.id,
        client_event_id="provider-change-evidence",
        report_type="note",
        reporter_name=admin.full_name,
        description="QA report before provider change",
    ))
    db.commit()

    with pytest.raises(HTTPException) as error:
        reservation_service._discard_checkout_task_for_assignment_change(
            db, reservation, task, True
        )

    assert error.value.status_code == 409
    db.expire_all()
    assert db.get(TaskItem, task.id) is not None
    assert db.query(TaskReport).filter_by(task_item_id=task.id).count() == 1


def test_shared_company_admin_can_manage_reservations(db):
    cleaning_company = _company(db, "Ownet", "OWNET")
    real_estate = _company(db, "Inmobiliaria", "REALESTATE")
    location = _location(db, cleaning_company)
    real_estate_admin = _user(db, real_estate, role_id=1, email="admin@realestate.test")
    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=real_estate.id,
            relationship_type="property_manager",
            can_manage_reservations=True,
            can_manage_tasks=False,
            can_view_sensitive=True,
        )
    )
    db.commit()

    reservation = reservation_service.create_reservation(
        db, real_estate_admin, _reservation_data(location.id)
    )

    assert reservation.location_id == location.id
    assert reservation.guest_count == 5
    assert reservation.owner_company_id == real_estate.id

    with pytest.raises(HTTPException) as owner_error:
        location_access_service.require_location_owner(db, real_estate_admin, location.id)
    assert owner_error.value.status_code == 403

    with pytest.raises(HTTPException) as task_error:
        task_item_service.create_task_item(
            db,
            real_estate_admin,
            TaskItemCreate(
                title="No permitida",
                unit="servicio",
                location_id=location.id,
                user_id=real_estate_admin.id,
            ),
        )
    assert task_error.value.status_code == 403


def test_basic_plan_cannot_read_or_manage_reservations(db):
    company = _company(db, "Basic planning", "BASIC-PLANNING")
    company.subscription_plan = "basic"
    db.add(company)
    db.commit()
    admin = _user(db, company, role_id=1, email="basic-planning@test.com")
    location = _location(db, company)

    with pytest.raises(HTTPException) as read_error:
        reservation_service.list_reservations(db, admin)
    with pytest.raises(HTTPException) as write_error:
        reservation_service.create_reservation(
            db,
            admin,
            _reservation_data(location.id),
        )

    assert read_error.value.status_code == 403
    assert write_error.value.status_code == 403
    assert read_error.value.headers["X-WorkHive-Error-Code"] == "entitlement.feature_not_in_plan"
    assert write_error.value.headers["X-WorkHive-Error-Code"] == "entitlement.feature_not_in_plan"


def test_location_default_service_provider_can_be_changed_without_transferring_owner(db):
    owner = _company(db, "Port Blanc", "PORTBLANC")
    provider = _company(db, "Ownet", "OWNET")
    location = _location(db, owner)
    location.owner_company_id = owner.id
    location.managing_company_id = owner.id
    db.add(
        CompanyCollaboration(
            initiator_company_id=owner.id,
            partner_company_id=provider.id,
            status="accepted",
            role_type="service_provider",
        )
    )
    db.commit()

    updated = location_service.update_location(
        db,
        location.id,
        LocationUpdate(default_service_provider_id=provider.id),
        owner.id,
    )

    assert updated.owner_company_id == owner.id
    assert updated.default_service_provider_id == provider.id
    access = (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location.id,
            LocationCompanyAccess.company_id == provider.id,
        )
        .one()
    )
    assert access.relationship_type == "default_service_provider"
    assert access.can_manage_tasks is True

    cleared = location_service.update_location(
        db,
        location.id,
        LocationUpdate(default_service_provider_id=None),
        owner.id,
    )
    assert cleared.owner_company_id == owner.id
    assert cleared.default_service_provider_id is None
    db.refresh(access)
    assert access.relationship_type == "service_provider"


def test_unlinking_collaboration_clears_default_provider_and_access(db):
    owner = _company(db, "Port Blanc", "PORTBLANC")
    provider = _company(db, "Ownet", "OWNET")
    owner_admin = _user(db, owner, role_id=1, email="owner@portblanc.test")
    location = _location(db, owner)
    location.owner_company_id = owner.id
    location.managing_company_id = owner.id
    location.default_service_provider_id = provider.id
    collaboration = CompanyCollaboration(
        initiator_company_id=owner.id,
        partner_company_id=provider.id,
        status="accepted",
        role_type="service_provider",
    )
    db.add_all(
        [
            collaboration,
            LocationCompanyAccess(
                location_id=location.id,
                company_id=provider.id,
                relationship_type="default_service_provider",
                can_manage_tasks=True,
            ),
        ]
    )
    db.commit()

    collaboration_service.unlink_collaboration(
        db, owner_admin, collaboration.id
    )

    db.refresh(location)
    assert location.default_service_provider_id is None
    assert (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location.id,
            LocationCompanyAccess.company_id == provider.id,
        )
        .first()
        is None
    )


def test_revoking_location_access_clears_default_provider(db):
    owner = _company(db, "Port Blanc", "PORTBLANC")
    provider = _company(db, "Ownet", "OWNET")
    owner_admin = _user(db, owner, role_id=1, email="owner-access@portblanc.test")
    location = _location(db, owner)
    location.owner_company_id = owner.id
    location.managing_company_id = owner.id
    location.default_service_provider_id = provider.id
    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=provider.id,
            relationship_type="default_service_provider",
            can_manage_tasks=True,
        )
    )
    db.commit()

    location_access_service.delete_location_access(
        db, owner_admin, location.id, provider.id
    )

    db.refresh(location)
    assert location.default_service_provider_id is None


def test_reservation_overlap_is_rejected(db):
    company = _company(db, "Ownet", "OWNET")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@ownet.test")
    data = _reservation_data(location.id)
    reservation_service.create_reservation(db, admin, data)

    with pytest.raises(HTTPException) as error:
        reservation_service.create_reservation(db, admin, data)

    assert error.value.status_code == 409


def test_reservation_availability_accepts_touching_boundaries_but_rejects_real_overlap(db):
    company = _company(db, "Availability", "AVAILABILITY")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@availability.test")
    check_in = datetime(2026, 11, 2, 16, 0, tzinfo=timezone.utc)
    check_out = datetime(2026, 11, 4, 11, 0, tzinfo=timezone.utc)

    def book(start: datetime, end: datetime):
        return reservation_service.create_reservation(
            db,
            admin,
            ReservationCreate(
                location_id=location.id,
                check_in_at=start,
                check_out_at=end,
                cleaning_required=False,
            ),
        )

    first = book(check_in, check_out)
    before = book(check_in - timedelta(days=1), check_in)
    after = book(check_out, check_out + timedelta(days=1))
    assert len({first.id, before.id, after.id}) == 3

    with pytest.raises(HTTPException) as left_overlap:
        book(check_in - timedelta(days=1), check_in + timedelta(microseconds=1))
    with pytest.raises(HTTPException) as right_overlap:
        book(check_out - timedelta(microseconds=1), check_out + timedelta(days=1))
    assert left_overlap.value.status_code == 409
    assert right_overlap.value.status_code == 409
    assert db.query(Reservation).filter_by(location_id=location.id).count() == 3


def test_reservation_availability_excludes_itself_and_releases_cancelled_stay(db):
    company = _company(db, "AvailabilityUpdate", "AVAILABILITYUPDATE")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@availability-update.test")
    check_in = datetime(2026, 11, 2, 16, 0, tzinfo=timezone.utc)
    check_out = datetime(2026, 11, 4, 11, 0, tzinfo=timezone.utc)
    first = reservation_service.create_reservation(
        db,
        admin,
        ReservationCreate(
            location_id=location.id,
            check_in_at=check_in,
            check_out_at=check_out,
            cleaning_required=False,
        ),
    )

    same_dates = reservation_service.update_reservation(
        db, admin, first.id, ReservationUpdate(notes="Same stay dates")
    )
    assert same_dates.id == first.id
    reservation_service.update_reservation(
        db, admin, first.id, ReservationUpdate(status="cancelled")
    )
    replacement = reservation_service.create_reservation(
        db,
        admin,
        ReservationCreate(
            location_id=location.id,
            check_in_at=check_in,
            check_out_at=check_out,
            cleaning_required=False,
        ),
    )
    assert replacement.id != first.id


def test_consecutive_external_reservations_create_independent_requests(db):
    issuer = _company(db, "Inmobiliaria", "INMO")
    receiver = _company(db, "Ownet", "OWNET")
    location = _location(db, issuer)
    issuer_admin = _user(db, issuer, role_id=1, email="admin@inmo.test")
    receiver_admin = _user(db, receiver, role_id=1, email="admin@ownet.test")
    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=receiver.id,
            relationship_type="service_provider",
            can_manage_reservations=False,
            can_manage_tasks=True,
        )
    )
    db.commit()

    first = ReservationCreate(
        location_id=location.id,
        check_in_at=datetime(2026, 6, 7, 16, 0, tzinfo=timezone.utc),
        check_out_at=datetime(2026, 6, 9, 11, 0, tzinfo=timezone.utc),
        guest_count=4,
        cleaning_required=True,
        assigned_company_id=receiver.id,
    )
    second = ReservationCreate(
        location_id=location.id,
        check_in_at=datetime(2026, 6, 9, 16, 0, tzinfo=timezone.utc),
        check_out_at=datetime(2026, 6, 13, 11, 0, tzinfo=timezone.utc),
        guest_count=5,
        cleaning_required=True,
        assigned_company_id=receiver.id,
    )

    first_reservation = reservation_service.create_reservation(
        db, issuer_admin, first
    )
    second_reservation = reservation_service.create_reservation(
        db, issuer_admin, second
    )

    requests = (
        db.query(TaskItem)
        .filter(
            TaskItem.checkout_reservation_id.in_(
                [first_reservation.id, second_reservation.id]
            )
        )
        .order_by(TaskItem.checkout_reservation_id)
        .all()
    )
    assert len(requests) == 2
    assert {task.status for task in requests} == {"requested"}
    assert {task.user_id for task in requests} == {receiver_admin.id}
    assert {task.company_id for task in requests} == {receiver.id}
    first_request = next(
        task
        for task in requests
        if task.checkout_reservation_id == first_reservation.id
    )
    second_request = next(
        task
        for task in requests
        if task.checkout_reservation_id == second_reservation.id
    )
    assert first_request.next_reservation_id == second_reservation.id
    assert (
        first_request.next_reservation.check_in_at
        == second_reservation.check_in_at
    )
    assert first_request.due_at == second_reservation.check_in_at
    assert first_request.priority == "high"
    assert second_request.next_reservation_id is None
    assert first_request.scheduled_start_at == first_reservation.check_out_at

    with pytest.raises(HTTPException) as planning_error:
        task_item_service.accept_task_item(
            db,
            receiver_admin,
            first_request.id,
            TaskAcceptRequest(
                scheduled_start_at=datetime(2026, 6, 10, 12, 0)
            ),
        )
    assert planning_error.value.status_code == 400

    accepted_request = task_item_service.accept_task_item(
        db,
        receiver_admin,
        first_request.id,
        TaskAcceptRequest(
            scheduled_start_at=datetime(2026, 6, 9, 12, 0)
        ),
    )
    assert accepted_request.status == "accepted"
    assert accepted_request.scheduled_start_at == datetime(2026, 6, 9, 12, 0)
    assert accepted_request.accepted_by_user_id == receiver_admin.id
    assert accepted_request.accepted_by_name == receiver_admin.full_name

    operational_update = task_item_service.update_task_item(
        db,
        receiver_admin,
        first_request.id,
        TaskItemUpdate(
            price=145.0,
            quantity=2,
            unit="servicio",
            user_id=receiver_admin.id,
        ),
    )
    assert operational_update.price == 145.0
    assert operational_update.quantity == 2

    with pytest.raises(HTTPException) as source_field_error:
        task_item_service.update_task_item(
            db,
            receiver_admin,
            first_request.id,
            TaskItemUpdate(title="Título cambiado por el receptor"),
        )
    assert source_field_error.value.status_code == 403


def test_external_reservation_task_syncs_only_to_receiver_calendar(db):
    issuer = _company(db, "Inmobiliaria", "INMOCALENDAR")
    receiver = _company(db, "Ownet", "OWNETCALENDAR")
    location = _location(db, issuer)
    issuer_admin = _user(db, issuer, role_id=1, email="admin@inmocalendar.test")
    receiver_admin = _user(db, receiver, role_id=1, email="admin@ownetcalendar.test")
    db.add_all(
        [
            LocationCompanyAccess(
                location_id=location.id,
                company_id=receiver.id,
                relationship_type="service_provider",
                can_manage_reservations=False,
                can_manage_tasks=True,
            ),
            GoogleCalendarConnection(
                company_id=receiver.id,
                connected_by_user_id=receiver_admin.id,
                owner_user_id=receiver_admin.id,
                calendar_id="workhive-ownet-calendar",
                calendar_name="WorkHive - Ownet",
                access_token_encrypted="encrypted-access-token",
            ),
        ]
    )
    db.commit()

    reservation = reservation_service.create_reservation(
        db,
        issuer_admin,
        ReservationCreate(
            location_id=location.id,
            check_in_at=datetime(2026, 7, 7, 16, 0, tzinfo=timezone.utc),
            check_out_at=datetime(2026, 7, 9, 11, 0, tzinfo=timezone.utc),
            guest_count=3,
            cleaning_required=True,
            assigned_company_id=receiver.id,
        ),
    )
    task = db.query(TaskItem).filter_by(checkout_reservation_id=reservation.id).one()

    calendar_sync_service.enqueue_task_sync(db, task)

    jobs = db.query(CalendarSyncJob).filter_by(task_id=task.id).all()
    assert [(job.company_id, job.user_id, job.operation) for job in jobs] == [
        (receiver.id, receiver_admin.id, "upsert")
    ]
    assert not db.query(CalendarSyncJob).filter_by(
        company_id=issuer.id,
        task_id=task.id,
    ).count()


def test_internal_reservation_does_not_create_self_provider_access(db):
    company = _company(db, "Inmobiliaria", "INMO")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@inmo.test")

    reservation_service.create_reservation(
        db,
        admin,
        _reservation_data(location.id),
    )

    self_access = (
        db.query(LocationCompanyAccess)
        .filter(
            LocationCompanyAccess.location_id == location.id,
            LocationCompanyAccess.company_id == company.id,
        )
        .first()
    )
    assert self_access is None


def test_service_provider_selector_excludes_current_company(db):
    issuer = _company(db, "Inmobiliaria", "INMO")
    receiver = _company(db, "Ownet", "OWNET")
    location = _location(db, issuer)
    issuer_admin = _user(db, issuer, role_id=1, email="admin@inmo.test")
    db.add_all(
        [
            LocationCompanyAccess(
                location_id=location.id,
                company_id=issuer.id,
                relationship_type="service_provider",
                can_manage_tasks=True,
            ),
            CompanyCollaboration(
                initiator_company_id=receiver.id,
                partner_company_id=issuer.id,
                role_type="property_manager",
                status="accepted",
            ),
        ]
    )
    db.commit()

    providers = location_service.get_location_service_providers(
        db,
        issuer_admin,
        location.id,
    )

    assert [provider.id for provider in providers] == [receiver.id]


def test_explicit_self_assignment_is_rejected_without_creating_reservation(db):
    company = _company(db, "Inmobiliaria", "INMO")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@inmo.test")
    data = _reservation_data(location.id)
    data.assigned_company_id = company.id

    with pytest.raises(HTTPException) as error:
        reservation_service.create_reservation(db, admin, data)

    assert error.value.status_code == 400
    assert reservation_service.list_reservations(db, admin) == []


def test_viewer_cannot_create_reservations_and_tasks_can_be_standalone(db):
    company = _company(db, "Ownet", "OWNET")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@ownet.test")
    viewer = _user(db, company, role_id=3, email="worker@ownet.test")

    with pytest.raises(HTTPException) as error:
        reservation_service.create_reservation(db, viewer, _reservation_data(location.id))
    assert error.value.status_code == 403

    task = task_item_service.create_task_item(
        db,
        admin,
        TaskItemCreate(
            title="Limpieza sin huéspedes",
            unit="servicio",
            location_id=location.id,
            user_id=viewer.id,
            service_context="standalone",
        ),
    )

    assert task.checkout_reservation_id is None
    assert task.next_reservation_id is None
    assert task.service_context == "standalone"


def test_same_company_manager_can_edit_reservation_but_viewer_cannot(db):
    company = _company(db, "SameCompanyRoles", "SAMECOMPANYROLES")
    location = _location(db, company)
    manager = _user(db, company, role_id=2, email="manager@same-company-roles.test")
    viewer = _user(db, company, role_id=3, email="viewer@same-company-roles.test")
    reservation = reservation_service.create_reservation(
        db,
        manager,
        ReservationCreate(
            location_id=location.id,
            check_in_at=datetime(2026, 11, 2, 16, 0, tzinfo=timezone.utc),
            check_out_at=datetime(2026, 11, 4, 11, 0, tzinfo=timezone.utc),
            cleaning_required=False,
        ),
    )

    for change in [
        lambda: reservation_service.update_reservation(
            db, viewer, reservation.id, ReservationUpdate(notes="Unauthorized")
        ),
        lambda: reservation_service.delete_reservation(db, viewer, reservation.id),
    ]:
        with pytest.raises(HTTPException) as denied:
            change()
        assert denied.value.status_code == 403
    db.refresh(reservation)
    assert reservation.notes is None
    assert reservation_service.get_reservation(db, manager, reservation.id).id == reservation.id

    updated = reservation_service.update_reservation(
        db, manager, reservation.id, ReservationUpdate(notes="Manager update")
    )
    assert updated.notes == "Manager update"
    cancelled = reservation_service.update_reservation(
        db, manager, reservation.id, ReservationUpdate(status="cancelled")
    )
    assert cancelled.status == "cancelled"


def test_reservation_api_rejects_viewer_mutations_without_changing_the_stay(client, db):
    company = _company(db, "API reservation permissions", "APIRESERVATION")
    company.subscription_status = "active"
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@api-reservation.test")
    manager = _user(db, company, role_id=2, email="manager@api-reservation.test")
    viewer = _user(db, company, role_id=3, email="viewer@api-reservation.test")
    db.commit()
    check_in_at = datetime.now(timezone.utc) + timedelta(days=2)
    payload = ReservationCreate(
        location_id=location.id,
        check_in_at=check_in_at,
        check_out_at=check_in_at + timedelta(days=2),
        cleaning_required=False,
    ).model_dump(mode="json")

    denied_create = client.post(
        "/api/v1/reservations/", headers=_headers(viewer), json=payload
    )
    assert denied_create.status_code == 403
    assert db.query(Reservation).filter_by(location_id=location.id).count() == 0

    created = client.post(
        "/api/v1/reservations/", headers=_headers(admin), json=payload
    )
    assert created.status_code == 201
    reservation_id = created.json()["id"]

    denied_update = client.patch(
        f"/api/v1/reservations/{reservation_id}",
        headers=_headers(viewer),
        json={"notes": "viewer change"},
    )
    denied_delete = client.delete(
        f"/api/v1/reservations/{reservation_id}", headers=_headers(viewer)
    )
    denied_dispatch = client.post(
        f"/api/v1/reservations/{reservation_id}/dispatch-cleaning",
        headers=_headers(viewer),
    )
    assert denied_update.status_code == 403
    assert denied_delete.status_code == 403
    assert denied_dispatch.status_code == 403
    db.expire_all()
    reservation = db.query(Reservation).filter_by(id=reservation_id).one()
    assert reservation.notes is None
    assert reservation.status == "confirmed"

    updated = client.patch(
        f"/api/v1/reservations/{reservation_id}",
        headers=_headers(manager),
        json={"notes": "manager change"},
    )
    assert updated.status_code == 200
    assert updated.json()["notes"] == "manager change"
    removed = client.delete(
        f"/api/v1/reservations/{reservation_id}", headers=_headers(manager)
    )
    assert removed.status_code == 204
    assert db.query(Reservation).filter_by(id=reservation_id).first() is None


def test_service_provider_cannot_link_reservations_when_creating_manual_work(db):
    issuer = _company(db, "Inmobiliaria", "INMOTASK")
    receiver = _company(db, "Limpiezas", "CLEANTASK")
    location = _location(db, issuer)
    issuer_admin = _user(db, issuer, role_id=1, email="admin@inmotask.test")
    receiver_admin = _user(db, receiver, role_id=1, email="admin@cleantask.test")
    reservation = reservation_service.create_reservation(
        db,
        issuer_admin,
        _reservation_data(location.id),
    )
    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=receiver.id,
            relationship_type="service_provider",
            # A misconfigured capability must not turn a cleaning company into
            # a reservation issuer.
            can_manage_reservations=True,
            can_manage_tasks=True,
        )
    )
    db.commit()

    assert not location_access_service.has_location_capability(
        db,
        receiver_admin,
        location,
        "can_manage_reservations",
    )

    with pytest.raises(HTTPException) as error:
        task_item_service.create_task_item(
            db,
            receiver_admin,
            TaskItemCreate(
                title="Limpieza manual",
                unit="servicio",
                location_id=location.id,
                checkout_reservation_id=reservation.id,
            ),
        )

    assert error.value.status_code == 403

    standalone_task = task_item_service.create_task_item(
        db,
        receiver_admin,
        TaskItemCreate(
            title="Limpieza propia",
            unit="servicio",
            location_id=location.id,
        ),
    )
    with pytest.raises(HTTPException) as update_error:
        task_item_service.update_task_item(
            db,
            receiver_admin,
            standalone_task.id,
            TaskItemUpdate(checkout_reservation_id=reservation.id),
        )

    assert update_error.value.status_code == 403
    db.refresh(standalone_task)
    assert standalone_task.checkout_reservation_id is None


def test_create_reservation_with_assigned_task(db):
    company = _company(db, "Ownet", "OWNET")
    other_company = _company(db, "Other", "OTHER")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@ownet.test")
    other_admin = _user(db, other_company, role_id=1, email="admin@other.test")
    other_worker = _user(db, other_company, role_id=3, email="worker@other.test")

    # 1. Internal work is already approved by the company that created it.
    data = _reservation_data(location.id)
    reservation = reservation_service.create_reservation(db, admin, data)
    assert reservation.id is not None
    assert reservation.owner_company_id == company.id

    task = db.query(TaskItem).filter(TaskItem.checkout_reservation_id == reservation.id).first()
    assert task is not None
    assert task.user_id == admin.id
    assert task.company_id == company.id
    assert task.status == "accepted"
    assert task.service_context == "checkout"

    # 2. External reservation: should create an unassigned request for the provider
    data_ext = _reservation_data(location.id)
    data_ext.check_in_at += timedelta(days=5)
    data_ext.check_out_at += timedelta(days=5)
    data_ext.assigned_company_id = other_company.id
    data_ext.notes = "Dejar las llaves en la caja exterior."

    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=other_company.id,
            relationship_type="service_provider",
            can_manage_reservations=True,
            can_manage_tasks=True,
        )
    )
    db.commit()

    template = TemplateTask(
        name="Cambio de huéspedes",
        description="- [ ] Cambiar sábanas\n- [ ] Preparar toallas",
        default_price=120.0,
        unit="servicio",
        company_id=company.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    db.add(
        LocationTemplate(
            location_id=location.id,
            template_task_id=template.id,
        )
    )
    db.commit()

    reservation_ext = reservation_service.create_reservation(db, admin, data_ext)
    assert reservation_ext.id is not None
    assert reservation_ext.owner_company_id == company.id

    task_ext = db.query(TaskItem).filter(TaskItem.checkout_reservation_id == reservation_ext.id).first()
    assert task_ext is not None
    assert task_ext.user_id == other_admin.id
    assert task_ext.company_id == other_company.id
    assert task_ext.status == "requested"
    assert task_ext.template_task_id is None
    assert "Cambiar sábanas" in task_ext.description
    assert "Preparar toallas" in task_ext.description
    assert task_ext.price == 120.0
    assert task_ext.checkout_reservation.notes == "Dejar las llaves en la caja exterior."
    task_response = TaskItemResponse.model_validate(task_ext)
    assert task_response.checkout_reservation is not None
    assert task_response.checkout_reservation.notes == "Dejar las llaves en la caja exterior."

    template_task_service.update_template_task(
        db,
        template.id,
        TemplateTaskUpdate(
            description=(
                "- [ ] Cambiar sábanas\n"
                "- [ ] Preparar toallas\n"
                "- [ ] Limpiar garaje"
            )
        ),
        company.id,
    )
    live_snapshot = reservation_service.get_live_external_task_snapshot(db, task_ext)
    assert "Limpiar garaje" in live_snapshot["description"]

    accepted = task_item_service.accept_task_item(
        db,
        other_admin,
        task_ext.id,
        TaskAcceptRequest(),
    )
    assert accepted.status == "accepted"
    assert accepted.accepted_by_user_id == other_admin.id
    assert "Limpiar garaje" in accepted.description
    db.refresh(task_ext)
    assert "Limpiar garaje" in task_ext.description

    assigned_description = task_item_service.update_task_item(
        db,
        other_admin,
        task_ext.id,
        TaskItemUpdate(
            description=(
                "- [ ] Cambiar sábanas "
                f"(@{other_worker.id}:worker)\n"
                "- [ ] Preparar toallas\n"
                "- [ ] Limpiar garaje"
            )
        ),
    ).description
    assert f"@{other_worker.id}:worker" in assigned_description

    template_task_service.update_template_task(
        db,
        template.id,
        TemplateTaskUpdate(
            description=(
                "- [ ] Cambiar sábanas\n"
                "- [ ] Preparar toallas\n"
                "- [ ] Limpiar garaje\n"
                "- [ ] Revisar terraza"
            )
        ),
        company.id,
    )
    accepted_snapshot = reservation_service.get_live_external_task_snapshot(
        db, task_ext
    )
    assert accepted_snapshot == {}
    db.refresh(task_ext)
    assert "Revisar terraza" not in task_ext.description
    assert f"@{other_worker.id}:worker" in task_ext.description
    response_snapshot = task_item_service.build_task_response(db, task_ext, other_admin)
    assert f"@{other_worker.id}:worker" in response_snapshot.description

    task_item_service.update_task_item(
        db,
        other_admin,
        task_ext.id,
        TaskItemUpdate(user_id=other_admin.id),
    )
    started = task_item_service.start_task_work(
        db,
        other_admin,
        task_ext.id,
        start_latitude=41.3851,
        start_longitude=2.1734,
        start_accuracy_meters=7.5,
    )
    assert "Revisar terraza" not in started.description
    assert f"@{other_worker.id}:worker" in started.description
    assert reservation_service.get_live_external_task_snapshot(db, started) == {}
    issuer_response = reservation_service.build_reservation_response(
        db,
        reservation_ext,
        admin,
    )
    assert len(issuer_response.cleaning_start_locations) == 1
    assert issuer_response.cleaning_start_locations[0].latitude == 41.3851
    assert issuer_response.cleaning_start_locations[0].longitude == 2.1734


def test_reservation_exceeds_location_capacity(db):
    company = _company(db, "Ownet", "OWNET")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@ownet.test")
    
    # Configurar la capacidad máxima a 3
    location.max_capacity = 3
    db.commit()
    
    # 1. Intentar crear reserva con 4 huéspedes (debe fallar)
    data = _reservation_data(location.id)
    data.guest_count = 4
    
    with pytest.raises(HTTPException) as error:
        reservation_service.create_reservation(db, admin, data)
    assert error.value.status_code == 400
    assert "exceeds the maximum capacity" in error.value.detail

    # 2. Intentar crear reserva con 3 huéspedes (debe funcionar)
    data.guest_count = 3
    reservation = reservation_service.create_reservation(db, admin, data)
    assert reservation.id is not None
    assert reservation.guest_count == 3


def test_emitter_sees_operational_task_but_not_receiver_request(db):
    company = _company(db, "Ownet", "OWNET")
    other_company = _company(db, "Other", "OTHER")
    location = _location(db, company)
    admin = _user(db, company, role_id=1, email="admin@ownet.test")
    other_admin = _user(db, other_company, role_id=1, email="admin@other.test")

    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=other_company.id,
            relationship_type="service_provider",
            can_manage_reservations=True,
            can_manage_tasks=True,
        )
    )
    db.commit()

    data_ext = _reservation_data(location.id)
    data_ext.assigned_company_id = other_company.id
    reservation_ext = reservation_service.create_reservation(db, admin, data_ext)
    
    # Verify that get_task_items for status="requested" for admin (initiator) is empty
    tasks_admin = task_item_service.get_task_items(
        db,
        company_id=company.id,
        task_status="requested",
        include_requested=True,
    )
    assert len(tasks_admin) == 0

    # Verify that get_task_items for status="requested" for other_admin (receiver) has the task
    tasks_other = task_item_service.get_task_items(
        db,
        company_id=other_company.id,
        task_status="requested",
        include_requested=True,
    )
    assert len(tasks_other) == 1

    task_item_service.update_task_item(
        db,
        other_admin,
        tasks_other[0].id,
        TaskItemUpdate(status="pending"),
    )
    operational_for_issuer = task_item_service.get_task_items(
        db,
        company_id=company.id,
    )
    operational_for_receiver = task_item_service.get_task_items(
        db,
        company_id=other_company.id,
    )
    assert [task.id for task in operational_for_issuer] == [tasks_other[0].id]
    assert [task.id for task in operational_for_receiver] == [tasks_other[0].id]

    receiver_reservations = reservation_service.list_reservations(
        db,
        other_admin,
    )
    assert [item.id for item in receiver_reservations] == [reservation_ext.id]

    task_item_service.update_task_item(
        db,
        other_admin,
        tasks_other[0].id,
        TaskItemUpdate(status="rejected"),
    )

    rejected_for_receiver = task_item_service.get_task_items(
        db,
        company_id=other_company.id,
        task_status="rejected",
        include_requested=True,
    )
    rejected_for_issuer = task_item_service.get_task_items(
        db,
        company_id=company.id,
        task_status="rejected",
        include_requested=True,
    )

    assert rejected_for_receiver == []
    assert [task.id for task in rejected_for_issuer] == [tasks_other[0].id]


def test_template_catalog_is_independent_per_company(db):
    company = _company(db, "Ownet", "OWNET")
    other_company = _company(db, "Other", "OTHER")
    template_data = TemplateTaskCreate(
        name="Limpieza de salida",
        description="- [ ] Cambiar sábanas",
        default_price=100.0,
        unit="servicio",
    )

    company_template = template_task_service.create_template_task(
        db,
        template_data,
        company.id,
    )
    other_template = template_task_service.create_template_task(
        db,
        template_data,
        other_company.id,
    )

    assert company_template.id != other_template.id
    assert [
        template.id
        for template in template_task_service.get_template_tasks(db, company.id)
    ] == [company_template.id]
    assert [
        template.id
        for template in template_task_service.get_template_tasks(
            db, other_company.id
        )
    ] == [other_template.id]

    with pytest.raises(HTTPException) as error:
        template_task_service.get_template_task(
            db,
            other_template.id,
            company.id,
        )
    assert error.value.status_code == 404


def test_receiver_can_read_owner_location_templates_without_mixing_catalogs(db):
    owner = _company(db, "Port Blanc", "PORTBLANC")
    receiver = _company(db, "Ownet", "OWNET")
    location = _location(db, owner)
    receiver_admin = _user(db, receiver, role_id=1, email="admin@ownet.test")
    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=receiver.id,
            relationship_type="service_provider",
            can_manage_tasks=True,
        )
    )

    owner_template = TemplateTask(
        name="Limpieza de cambio",
        description="- [ ] Cambiar sábanas\n- [ ] Preparar baños",
        default_price=95.0,
        unit="servicio",
        company_id=owner.id,
    )
    receiver_template = TemplateTask(
        name="Control interno",
        description="- [ ] Revisar material",
        default_price=10.0,
        unit="servicio",
        company_id=receiver.id,
    )
    db.add_all([owner_template, receiver_template])
    db.commit()
    db.refresh(owner_template)
    db.refresh(receiver_template)
    db.add(
        LocationTemplate(
            location_id=location.id,
            template_task_id=owner_template.id,
        )
    )
    db.commit()

    visible_location = location_service.get_location(
        db, location.id, receiver_admin.company_id
    )
    visible_templates = location_template_service.get_templates_by_location(
        db,
        location.id,
        visible_location.owner_company_id,
        0,
        100,
    )

    assert [item.template_task_id for item in visible_templates] == [owner_template.id]
    assert visible_templates[0].template.description == (
        "- [ ] Cambiar sábanas\n- [ ] Preparar baños"
    )
    assert receiver_template.id not in {
        item.template_task_id for item in visible_templates
    }

    with pytest.raises(HTTPException) as error:
        location_access_service.require_location_owner(
            db,
            receiver_admin,
            location.id,
        )
    assert error.value.status_code == 403
