from app.db.session import SessionLocal
from app.models.google_calendar_connection import GoogleCalendarConnection
from app.services.calendar_sync_service import synchronize


def main() -> None:
    db = SessionLocal()
    try:
        company_ids = [
            company_id
            for (company_id,) in db.query(
                GoogleCalendarConnection.company_id
            ).distinct().all()
        ]
        synchronized = 0
        failed = 0
        for company_id in company_ids:
            try:
                synchronize(db, company_id)
                synchronized += 1
            except Exception as exc:
                failed += 1
                print(f"Company {company_id}: synchronization failed: {exc}")
        print(
            f"Synchronized {synchronized} company calendars; "
            f"{failed} failed"
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
