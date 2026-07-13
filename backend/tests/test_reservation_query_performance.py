from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from app.models.reservation import Reservation
from tests.test_task_security_delivery import _company, _headers, _location, _user


def test_reservation_listing_uses_a_bounded_number_of_queries(client, db):
    company = _company(db, "ReservationQueries")
    admin = _user(db, company, "admin@reservation-queries.test", 1)
    location = _location(db, company, "Casa Reservas")
    start = datetime.now(timezone.utc) + timedelta(days=1)
    db.add_all(
        Reservation(
            location_id=location.id,
            owner_company_id=company.id,
            created_by_user_id=admin.id,
            updated_by_user_id=admin.id,
            check_in_at=start + timedelta(days=index * 2),
            check_out_at=start + timedelta(days=index * 2 + 1),
            guest_count=2,
            cleaning_required=False,
        )
        for index in range(30)
    )
    db.commit()

    statements: list[str] = []

    def record_statement(*args):
        statements.append(args[2])

    event.listen(db.bind, "before_cursor_execute", record_statement)
    try:
        response = client.get(
            "/api/v1/reservations/",
            headers=_headers(admin),
        )
    finally:
        event.remove(db.bind, "before_cursor_execute", record_statement)

    assert response.status_code == 200, response.text
    assert len(response.json()) == 30
    assert len(statements) <= 20, (
        f"Reservation listing executed {len(statements)} SQL statements"
    )
