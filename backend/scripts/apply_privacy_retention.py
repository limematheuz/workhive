from app.db.session import SessionLocal
from app.services.privacy_service import apply_retention_policy


def main() -> None:
    db = SessionLocal()
    try:
        result = apply_retention_policy(db)
        print(result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
