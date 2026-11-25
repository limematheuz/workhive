import secrets
from hashlib import sha256
from time import time

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.audit_log import AuditLog
from app.models.platform_invitation import PlatformInvitation
from app.models.user import User
from app.repositories import platform_team as repository, role, user
from app.services.user_scope import is_platform_superadmin
from app.services.email_service.platform_team import notify_invitee


def require_manager(actor):
    if not (actor.is_active and is_platform_superadmin(actor) and actor.role.is_active):
        raise HTTPException(403, "Se requiere acceso de plataforma")


def audit(db, actor, action, invitation):
    db.add(AuditLog(actor_user_id=actor.id, action="platform.team." + action,
                    entity_type="platform_invitation", entity_id=str(invitation.id)))


def invitation_status(row):
    if row.revoked_by:
        return "revocada"
    if row.member_id and not row.token_digest:
        return "activa"
    return "caducada" if row.expires_at <= time() else "pendiente"


def list_team(db, actor):
    require_manager(actor)
    invitations = [
        {"id": row.id, "email": row.email, "invited_by": inviter, "revoked_by": revoker,
         "previously_activated": row.member_id is not None, "status": invitation_status(row)}
        for row, inviter, revoker in repository.roster(db)
    ]
    return invitations + [
        {"id": None, "email": person.email, "invited_by": None, "revoked_by": None, "previously_activated": True,
         "status": "activa" if person.is_active else "revocada"}
        for person in repository.initial_members(db)
    ]


def invite(db, actor, email):
    require_manager(actor)
    if len(email) > 255:
        raise HTTPException(422, "El correo supera la longitud admitida")
    row = repository.by_email(db, email)
    member = invitation_identity(db, row, email)
    if row and not row.revoked_by:
        if row.member_id and not row.token_digest:
            raise HTTPException(409, "Esta persona ya tiene acceso al equipo")
        if row.expires_at > time():
            raise HTTPException(409, "Ya existe una invitación pendiente para este correo")
    if row and (member or row.revoked_by):
        row.revoked_by = None
        row.invited_by = actor.id
        return send_renewal(db, actor, row, "reinvited")
    row = row or PlatformInvitation(email=email)
    token = renew_token(row)
    row.invited_by, row.issuer = actor.id, "workhive"
    row.revoked_by = None
    db.add(row)
    try:
        db.flush()
        audit(db, actor, "invited", row)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "La invitación ya existe") from exc
    result = deliver(email, token)
    if not result["email_sent"] and settings.is_production:
        pending = repository.by_token(db, sha256(token.encode()).hexdigest())
        if pending:
            pending.token_digest = None
            pending.expires_at = 0
            db.commit()
        raise HTTPException(503, "No se pudo enviar el correo. Comprueba el SMTP y vuelve a invitar.")
    return result


def invitation_identity(db, row, email):
    member = user.lock_password_reset_identity(db, email)
    if row and row.member_id:
        if (not member or member.id != row.member_id or not is_platform_superadmin(member)
                or not member.role.is_active):
            raise HTTPException(409, "Esta cuenta ya no corresponde al técnico invitado")
        if member.is_active:
            raise HTTPException(409, "Esta persona ya tiene acceso al equipo")
    elif member:
        if member.is_active and is_platform_superadmin(member):
            raise HTTPException(409, "Esta persona ya tiene acceso al equipo")
        raise HTTPException(409, "Este correo ya pertenece a otra cuenta de WorkHive")
    return member


def renew_token(row):
    token = "whi_" + secrets.token_urlsafe(32)
    row.token_digest = sha256(token.encode()).hexdigest()
    row.expires_at = int(time()) + 86400
    return token


def deliver(email, token):
    url = settings.FRONTEND_URL.rstrip("/") + "/reset-password#token=" + token
    sent = notify_invitee(email, url)
    return {"email_sent": sent, "invitation_url": None if sent else url}


def resend(db, actor, identifier):
    require_manager(actor)
    row = repository.by_id(db, identifier)
    if not row:
        raise HTTPException(404, "Invitación desconocida")
    if row.revoked_by or (row.member_id and not row.token_digest):
        raise HTTPException(409, "Solo puedes reenviar una invitación pendiente o caducada")
    invitation_identity(db, row, row.email)
    return send_renewal(db, actor, row, "resent")


def send_renewal(db, actor, row, action):
    token = renew_token(row)
    result = deliver(row.email, token)
    if not result["email_sent"] and settings.is_production:
        db.rollback()
        raise HTTPException(503, "No se pudo reenviar el correo. Vuelve a intentarlo.")
    audit(db, actor, action, row)
    db.commit()
    return result


def redeem_invitation(db, token, password):
    if not token.startswith("whi_"):
        return False
    row = repository.by_token(db, sha256(token.encode()).hexdigest())
    if not row or row.revoked_by or row.expires_at <= time():
        raise HTTPException(400, "Invitación inválida o caducada")
    member = invitation_identity(db, row, row.email)
    admin = role.get_role_by_name(db, "superadmin")
    if not admin or not admin.is_active:
        raise HTTPException(503, "Rol de plataforma no disponible")
    if member:
        member.is_active = True
        member.session_version += 1
    else:
        member = User(email=row.email, full_name=row.email[:100], role=admin)
    member.hashed_password = get_password_hash(password)
    db.add(member)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "La identidad ya está vinculada") from exc
    row.member_id = member.id
    row.token_digest = None
    audit(db, member, "accepted", row)
    db.commit()
    return True


def revoke(db, actor, identifier):
    require_manager(actor)
    row = repository.by_id(db, identifier)
    if not row:
        raise HTTPException(404, "Invitación desconocida")
    if row.member_id == actor.id:
        raise HTTPException(409, "No puedes revocar tu propio acceso")
    if row.revoked_by:
        return
    row.token_digest = None
    row.revoked_by = actor.id
    if row.member_id:
        member = db.get(User, row.member_id)
        member.is_active = False
        member.session_version += 1
    audit(db, actor, "revoked", row)
    db.commit()
