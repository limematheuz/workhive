from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.models.platform_invitation import PlatformInvitation as Invite
from app.models.user import User
from app.models.role import Role


def by_email(db: Session, email: str):
    return db.scalar(select(Invite).where(Invite.email == email).with_for_update())


def by_id(db: Session, identifier: int):
    return db.scalar(select(Invite).where(Invite.id == identifier).with_for_update())


def by_token(db: Session, digest: str):
    return db.scalar(select(Invite).where(Invite.token_digest == digest).with_for_update())


def roster(db: Session):
    revoker = aliased(User)
    return db.execute(select(Invite, User.email, revoker.email)
                      .join(User, Invite.invited_by == User.id)
                      .outerjoin(revoker, Invite.revoked_by == revoker.id)
                      .order_by(Invite.id.desc())).all()


def initial_members(db: Session):
    invited = select(Invite.id).where(Invite.member_id == User.id).exists()
    return db.scalars(select(User).join(Role).where(
        User.company_id.is_(None),
        Role.name == "superadmin", ~invited,
    ).order_by(User.id)).all()
