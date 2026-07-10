"""Create the first platform superadmin without persisting credentials."""

import argparse
from getpass import getpass

from pydantic import EmailStr, TypeAdapter

from app.core.security import get_password_hash
from app.db import base as _models  # noqa: F401 — registers all SQLAlchemy models
from app.db.session import SessionLocal
from app.models.user import User
from app.repositories.role import get_role_by_name
from app.repositories.user import get_user_by_email
from app.schemas.user import validate_user_password


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a platform superadmin using an interactive password prompt.",
    )
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="WorkHive Administrator")
    return parser.parse_args()


def read_password() -> str:
    password = validate_user_password(getpass("Password: "))
    confirmation = getpass("Repeat password: ")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")
    return password


def main() -> None:
    args = parse_args()
    email = str(TypeAdapter(EmailStr).validate_python(args.email)).lower()
    password = read_password()

    with SessionLocal() as db:
        if get_user_by_email(db, email):
            raise SystemExit("A user with this email already exists.")

        role = get_role_by_name(db, "superadmin")
        if role is None:
            raise SystemExit("The superadmin role does not exist. Run migrations first.")

        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=args.name,
            is_active=True,
            role_id=role.id,
            company_id=None,
        )
        db.add(user)
        db.commit()

    print(f"Platform superadmin created: {email}")


if __name__ == "__main__":
    main()
