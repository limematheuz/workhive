from app.db.session import SessionLocal
from app.services.fiscal_submission_service import retry_due_records


def main() -> None:
    db = SessionLocal()
    try:
        processed = retry_due_records(db)
        print(f"Processed {len(processed)} fiscal submission retries")
    finally:
        db.close()


if __name__ == "__main__":
    main()
