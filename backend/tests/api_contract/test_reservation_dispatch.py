from datetime import datetime, timedelta, timezone

from app.models.company_collaboration import CompanyCollaboration
from app.models.reservation import Reservation
from app.models.task_item import TaskItem


def test_owner_dispatches_one_cleaning_request_to_the_collaborating_provider(
    client, db, api_workspace
):
    qa = api_workspace
    db.add(
        CompanyCollaboration(
            initiator_company_id=qa.company.id,
            partner_company_id=qa.other.id,
            status="accepted",
        )
    )
    stay = Reservation(
        location_id=qa.location.id,
        owner_company_id=qa.company.id,
        assigned_company_id=qa.other.id,
        check_in_at=datetime.now(timezone.utc) + timedelta(days=1),
        check_out_at=datetime.now(timezone.utc) + timedelta(days=2),
        cleaning_required=True,
        status="confirmed",
    )
    db.add(stay)
    db.commit()
    path = f"/api/v1/reservations/{stay.id}/dispatch-cleaning"
    assert client.post(path, headers=qa.headers["worker"]).status_code == 403
    sent = client.post(path, headers=qa.headers["admin"])
    assert sent.status_code == 200 and sent.json()["service_request_sent_at"], sent.text
    task = db.query(TaskItem).filter_by(checkout_reservation_id=stay.id).one()
    assert task.company_id == qa.other.id and task.status == "requested"
    repeated = client.post(path, headers=qa.headers["admin"])
    assert repeated.status_code == 200, repeated.text
    assert db.query(TaskItem).filter_by(checkout_reservation_id=stay.id).count() == 1
