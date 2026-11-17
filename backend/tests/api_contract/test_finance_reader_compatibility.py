from datetime import datetime, timedelta, timezone

from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from test_client_permission_authorization import _assign_company_profile


def test_company_expenses_compatibility_route_honors_the_same_finance_read_capability(client, db, api_workspace):
    qa = api_workspace
    _assign_company_profile(db, company=qa.company, admin=qa.admin, user=qa.worker,
        name="QA finance read", permission_codes={"finance.read"})
    now = datetime.now(timezone.utc)
    booking = Reservation(owner_company_id=qa.company.id, assigned_company_id=qa.other.id,
        location_id=qa.location.id, check_in_at=now, check_out_at=now + timedelta(days=1),
        guest_count=1, status="confirmed", source="manual")
    db.add(booking); db.flush()
    task = TaskItem(company_id=qa.other.id, location_id=qa.location.id,
        checkout_reservation_id=booking.id, title="QA provider expense", unit="service",
        status="completed", price=19, quantity=2, date_done=now)
    db.add(task); db.commit()
    response = client.get(f"/api/v1/companies/{qa.company.id}/expenses", headers=qa.headers["worker"])
    assert response.status_code == 200, response.text
    assert len(response.json()) == 1
    assert response.json()[0]["amount"] == 38
    assert response.json()[0]["task_id"] == task.id
    assert client.get(f"/api/v1/companies/{qa.other.id}/expenses", headers=qa.headers["worker"]).status_code == 403
    assert client.get("/api/v1/labor-costs/rates", headers=qa.headers["worker"]).status_code == 403
    assert client.post("/api/v1/expenses/", headers=qa.headers["worker"], json={
        "expense_date": "2026-11-16", "category": "other", "description": "QA denied edit", "base_amount": 1,
    }).status_code == 403
