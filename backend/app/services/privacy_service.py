import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.data_subject_request import DataSubjectRequest
from app.models.privacy_consent import PrivacyConsent
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from app.schemas.privacy import PrivacyRequestCreate, PrivacyRequestResolve
from app.services.user_scope import is_company_admin, is_superadmin


def record_registration_acknowledgements(
    db: Session,
    *,
    user: User,
    request: Request,
    policy_version: str,
    marketing_consent: bool,
) -> None:
    common = {
        "user_id": user.id,
        "company_id": user.company_id,
        "policy_version": policy_version,
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent", "")[:500] or None,
    }
    db.add_all(
        [
            PrivacyConsent(
                **common,
                consent_type="terms",
                accepted=True,
            ),
            PrivacyConsent(
                **common,
                consent_type="privacy_notice",
                accepted=True,
            ),
            PrivacyConsent(
                **common,
                consent_type="marketing",
                accepted=marketing_consent,
            ),
        ]
    )
    db.commit()


def list_consents(db: Session, user: User) -> list[PrivacyConsent]:
    return (
        db.query(PrivacyConsent)
        .filter(PrivacyConsent.user_id == user.id)
        .order_by(PrivacyConsent.created_at.desc(), PrivacyConsent.id.desc())
        .all()
    )


def create_request(
    db: Session,
    user: User,
    data: PrivacyRequestCreate,
) -> DataSubjectRequest:
    existing = (
        db.query(DataSubjectRequest)
        .filter(
            DataSubjectRequest.requested_by_user_id == user.id,
            DataSubjectRequest.request_type == data.request_type,
            DataSubjectRequest.status.in_(("pending", "processing")),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An open request of this type already exists",
        )
    privacy_request = DataSubjectRequest(
        company_id=user.company_id,
        requested_by_user_id=user.id,
        request_type=data.request_type,
        status="pending",
        reason=data.reason,
    )
    db.add(privacy_request)
    db.commit()
    db.refresh(privacy_request)
    return privacy_request


def list_user_requests(db: Session, user: User) -> list[DataSubjectRequest]:
    return (
        db.query(DataSubjectRequest)
        .filter(DataSubjectRequest.requested_by_user_id == user.id)
        .order_by(DataSubjectRequest.requested_at.desc())
        .all()
    )


def list_company_requests(db: Session, user: User) -> list[DataSubjectRequest]:
    query = db.query(DataSubjectRequest)
    if not is_superadmin(user):
        query = query.filter(DataSubjectRequest.company_id == user.company_id)
    return query.order_by(DataSubjectRequest.requested_at.desc()).all()


def export_user_data(db: Session, user: User) -> dict:
    consents = list_consents(db, user)
    requests = list_user_requests(db, user)
    sessions = (
        db.query(WorkSession)
        .filter(WorkSession.user_id == user.id)
        .order_by(WorkSession.start_time)
        .all()
    )
    assigned_tasks = (
        db.query(TaskItem)
        .filter(TaskItem.user_id == user.id)
        .order_by(TaskItem.id)
        .all()
    )
    accepted_tasks = (
        db.query(TaskItem)
        .filter(TaskItem.accepted_by_user_id == user.id)
        .order_by(TaskItem.id)
        .all()
    )
    audit_events = (
        db.query(AuditLog)
        .filter(AuditLog.actor_user_id == user.id)
        .order_by(AuditLog.created_at)
        .all()
    )
    payload = {
        "format": "workhive-data-export-v1",
        "generated_at": datetime.now(timezone.utc),
        "profile": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "photo_url": user.photo_url,
            "is_active": user.is_active,
            "company_id": user.company_id,
            "role": user.role.name,
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        },
        "consents": [
            {
                "type": item.consent_type,
                "policy_version": item.policy_version,
                "accepted": item.accepted,
                "created_at": item.created_at,
                "withdrawn_at": item.withdrawn_at,
            }
            for item in consents
        ],
        "rights_requests": [
            {
                "id": item.id,
                "type": item.request_type,
                "status": item.status,
                "reason": item.reason,
                "requested_at": item.requested_at,
                "resolved_at": item.resolved_at,
                "resolution_notes": item.resolution_notes,
            }
            for item in requests
        ],
        "work_sessions": [
            {
                "id": item.id,
                "location_id": item.location_id,
                "task_item_id": item.task_item_id,
                "start_time": item.start_time,
                "end_time": item.end_time,
                "notes": item.notes,
            }
            for item in sessions
        ],
        "assigned_tasks": [_task_export(item) for item in assigned_tasks],
        "accepted_tasks": [_task_export(item) for item in accepted_tasks],
        "audit_events": [
            {
                "id": item.id,
                "action": item.action,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "details": item.details,
                "created_at": item.created_at,
            }
            for item in audit_events
        ],
    }
    return jsonable_encoder(payload)


def _task_export(task: TaskItem) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "notes": task.notes,
        "status": task.status,
        "location_id": task.location_id,
        "scheduled_start_at": task.scheduled_start_at,
        "due_at": task.due_at,
        "date_done": task.date_done,
        "created_at": task.created_at,
    }


def resolve_request(
    db: Session,
    *,
    request_id: int,
    resolver: User,
    data: PrivacyRequestResolve,
) -> DataSubjectRequest:
    privacy_request = db.get(DataSubjectRequest, request_id)
    if not privacy_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Privacy request not found",
        )
    if (
        not is_superadmin(resolver)
        and privacy_request.company_id != resolver.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Privacy request not found",
        )
    if privacy_request.status not in {"pending", "processing"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Privacy request is already resolved",
        )

    if data.decision == "complete" and privacy_request.request_type == "erasure":
        _anonymize_user(db, privacy_request.requested_by_user_id)

    privacy_request.status = (
        "completed" if data.decision == "complete" else "rejected"
    )
    privacy_request.resolution_notes = data.resolution_notes
    privacy_request.resolved_by_user_id = resolver.id
    privacy_request.resolved_at = datetime.now(timezone.utc)
    db.add(privacy_request)
    db.commit()
    db.refresh(privacy_request)
    return privacy_request


def _anonymize_user(db: Session, user_id: int | None) -> None:
    user = db.get(User, user_id) if user_id is not None else None
    if not user:
        return
    if is_company_admin(user) and user.company_id is not None:
        active_admins = (
            db.query(User)
            .join(User.role)
            .filter(
                User.company_id == user.company_id,
                User.is_active.is_(True),
                User.role.has(name="admin"),
            )
            .count()
        )
        if active_admins <= 1:
            company = db.get(Company, user.company_id)
            if company:
                company.is_active = False
                company.subscription_plan = "none"
                company.subscription_status = "inactive"
                company.trial_started_at = None
                company.trial_ends_at = None
                db.add(company)
            (
                db.query(User)
                .filter(User.company_id == user.company_id)
                .update(
                    {User.session_version: User.session_version + 1},
                    synchronize_session=False,
                )
            )
            return
    user.email = f"deleted+{user.id}@invalid.workhive.local"
    user.full_name = "Deleted user"
    user.photo_url = None
    user.hashed_password = get_password_hash(secrets.token_urlsafe(32))
    user.is_active = False
    user.session_version += 1
    db.add(user)


def apply_retention_policy(db: Session) -> dict[str, int]:
    now = datetime.now(timezone.utc)
    audit_cutoff = now - timedelta(days=settings.AUDIT_IP_RETENTION_DAYS)
    request_cutoff = now - timedelta(
        days=settings.DATA_SUBJECT_REQUEST_RETENTION_DAYS
    )
    redacted_ips = (
        db.query(AuditLog)
        .filter(
            AuditLog.created_at < audit_cutoff,
            AuditLog.ip_address.is_not(None),
        )
        .update({AuditLog.ip_address: None}, synchronize_session=False)
    )
    deleted_requests = (
        db.query(DataSubjectRequest)
        .filter(
            DataSubjectRequest.resolved_at < request_cutoff,
            DataSubjectRequest.status.in_(("completed", "rejected")),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return {
        "redacted_audit_ip_addresses": redacted_ips,
        "deleted_resolved_requests": deleted_requests,
    }
