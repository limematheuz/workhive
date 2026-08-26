import hashlib
import secrets

from sqlalchemy.orm import Session

from app.models.company_collaboration_invitation import CompanyCollaborationInvitation


def hash_invitation_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_verification_code(code: str) -> str:
    return "".join(char for char in code.upper() if char.isalnum())


def new_verification_code(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "".join(secrets.choice(alphabet) for _ in range(10))
        if not db.query(CompanyCollaborationInvitation.id).filter(
            CompanyCollaborationInvitation.verification_code_hash == hash_invitation_secret(code)
        ).first():
            return code
