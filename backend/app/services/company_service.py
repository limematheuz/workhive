from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from app.models.company import Company
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.models.user import User
from app.schemas.company import (
    CompanyCreate,
    CompanyMemberResponse,
    CompanyProvisionCreate,
    CompanyUpdate,
)
from app.repositories import company as company_repo
from app.repositories import user as user_repo
from app.repositories import role as role_repo
from fastapi import HTTPException, status
from app.core.config import settings
from app.core.security import get_password_hash
from app.schemas.company import CompanyExpenseResponse
from app.services.user_scope import (
    is_platform_superadmin,
    require_platform_superadmin,
)
from app.services import (
    company_entitlement_service,
    company_deletion_service,
    company_update_policy_service,
    organization_bootstrap_service,
)
from app.services.organization_authorization_service import require_capability


def get_companies(
    db: Session, current_user: User, skip: int = 0, limit: int = 100
) -> list[Company]:
    if is_platform_superadmin(current_user):
        return company_repo.get_all_companies(db, skip, limit)
    if not current_user.company_id:
        return []
    my_company = company_repo.get_company_by_id(db, current_user.company_id)
    return [my_company] if my_company else []


def count_companies(db: Session, current_user: User) -> int:
    """Return a tenant-safe total for the platform companies list."""
    if is_platform_superadmin(current_user):
        return company_repo.count_all_companies(db)
    if current_user.company_id is None:
        return 0
    return int(company_repo.get_company_by_id(db, current_user.company_id) is not None)


def get_company(db: Session, company_id: int, current_user: User) -> Company:
    company_update_policy_service.require_company_access(
        current_user,
        company_id,
        action="access",
    )
    existing_company = company_repo.get_company_by_id(db, company_id)
    if not existing_company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )

    return existing_company


def get_company_members(
    db: Session,
    company_id: int,
    current_user: User,
) -> list[CompanyMemberResponse]:
    require_platform_superadmin(current_user)
    if not company_repo.get_company_by_id(db, company_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return [
        CompanyMemberResponse(
            id=member.id,
            full_name=member.full_name,
            email=member.email,
            role=member.role.name,
            is_active=member.is_active,
        )
        for member in user_repo.get_company_members(db, company_id)
    ]


def create_company(db: Session, company_data: CompanyCreate, creator: User) -> Company:
    if not settings.ALLOW_PUBLIC_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-service company creation is disabled",
        )
    if creator.company_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already belongs to a company",
        )
    existing = company_repo.get_company_by_tax_id(db, company_data.tax_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tax ID already exists",
        )

    now = datetime.now(timezone.utc)
    new_company = company_repo.create_company(db, company_data)
    # Trial is a Top subscription with a temporary status, not a plan code.
    new_company.subscription_plan = "top"
    new_company.subscription_status = "trialing"
    new_company.trial_started_at = now
    new_company.trial_ends_at = now + timedelta(days=14)
    db.add(new_company)
    company_entitlement_service.synchronize_company_subscription(
        db,
        new_company,
        reason="company.self_service_created",
        actor_user_id=creator.id,
        now=now,
    )
    db.commit()
    db.refresh(new_company)

    admin_role = role_repo.get_role_by_name(db, "admin")
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Role 'admin' not configured in database",
        )
    creator.role = admin_role
    creator.company = new_company
    db.flush()
    organization_bootstrap_service.ensure_user_membership(db, creator)
    db.commit()
    db.refresh(creator)
    db.expire(creator, ["role", "company"])

    return new_company


def provision_company(
    db: Session,
    provision_data: CompanyProvisionCreate,
    current_user: User,
) -> Company:
    require_platform_superadmin(current_user)
    if company_repo.get_company_by_tax_id(db, provision_data.tax_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tax ID already exists",
        )
    if user_repo.get_user_by_email(db, provision_data.owner_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Owner email already registered",
        )

    admin_role = role_repo.get_role_by_name(db, "admin")
    if not admin_role:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Role 'admin' not configured in database",
        )

    now = datetime.now(timezone.utc)
    is_trial = provision_data.subscription_plan == "trial"
    trial_days = provision_data.trial_days or 14
    if (
        provision_data.commercial_terms is not None
        and provision_data.commercial_terms.effective_at > now
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="La fecha efectiva de las condiciones comerciales no puede ser futura",
        )
    # "Trial" is not a product plan.  Every trial uses Top and only its status
    # and end date make it a trial.  This is the same representation used by
    # the entitlement resolver and the platform plan-management screen.
    effective_plan = "top" if is_trial else provision_data.subscription_plan
    company = Company(
        name=provision_data.name,
        tax_id=provision_data.tax_id,
        address=provision_data.address,
        phone=provision_data.phone,
        email=provision_data.email,
        is_active=True,
        onboarding_completed=False,
        subscription_plan=effective_plan,
        subscription_status="trialing" if is_trial else "active",
        trial_started_at=now if is_trial else None,
        trial_ends_at=now + timedelta(days=trial_days) if is_trial else None,
    )
    try:
        db.add(company)
        db.flush()
        owner = User(
            email=provision_data.owner_email,
            hashed_password=get_password_hash(provision_data.owner_password),
            full_name=provision_data.owner_full_name,
            is_active=True,
            email_verified_at=datetime.now(timezone.utc),
            role_id=admin_role.id,
            company_id=company.id,
        )
        db.add(owner)
        db.flush()
        organization_bootstrap_service.ensure_user_membership(db, owner)
        company_entitlement_service.synchronize_company_subscription(
            db,
            company,
            reason="company.provisioned",
            actor_user_id=current_user.id,
            now=now,
            commercial_terms=(
                company_entitlement_service.CommercialSubscriptionTerms(
                    billing_interval=provision_data.commercial_terms.billing_interval,
                    amount_cents=provision_data.commercial_terms.amount_cents,
                    currency=provision_data.commercial_terms.currency,
                    tax_behavior=provision_data.commercial_terms.tax_behavior,
                    effective_at=provision_data.commercial_terms.effective_at,
                )
                if provision_data.commercial_terms is not None
                else None
            ),
        )
        db.commit()
        db.refresh(company)
        return company
    except Exception:
        db.rollback()
        raise


def update_company(
    db: Session, company_id: int, company_update: CompanyUpdate, current_user: User
) -> Company:
    company_update_policy_service.require_company_access(
        current_user,
        company_id,
        action="update",
    )
    db_company = company_repo.get_company_by_id(db, company_id)
    if not db_company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
        )
    company_update_policy_service.require_company_update_permissions(
        current_user,
        company_update.model_fields_set,
    )
    if company_update.tax_id is not None:
        existing_tax_id_in_company = company_repo.get_company_by_tax_id(
            db, tax_id=company_update.tax_id
        )
        if existing_tax_id_in_company and existing_tax_id_in_company.id != company_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tax ID already exists in another company",
            )

    should_revoke_company_sessions = (
        company_update_policy_service.requires_session_revocation(
            company_update.model_fields_set
        )
    )

    updated_company = company_repo.update_company(db, db_company, company_update)
    if should_revoke_company_sessions:
        (
            db.query(User)
            .filter(User.company_id == company_id)
            .update(
                {User.session_version: User.session_version + 1},
                synchronize_session=False,
            )
        )
        db.commit()
        db.refresh(updated_company)
    return updated_company


def delete_company_permanently(
    db: Session,
    company_id: int,
    current_user: User,
) -> None:
    require_platform_superadmin(current_user)
    company_deletion_service.delete_empty_company_permanently(
        db,
        company_id=company_id,
    )


def get_company_expenses(
    db: Session,
    company_id: int,
    current_user: User,
) -> list[CompanyExpenseResponse]:
    get_company(db, company_id, current_user)
    require_capability(db, current_user, "finance.read")
    rows = (
        db.query(TaskItem)
        .join(
            Reservation,
            TaskItem.checkout_reservation_id == Reservation.id,
        )
        .filter(
            Reservation.owner_company_id == company_id,
            TaskItem.company_id != company_id,
            TaskItem.status == "completed",
        )
        .order_by(TaskItem.date_done.asc(), TaskItem.created_at.asc())
        .all()
    )
    return [
        CompanyExpenseResponse(
            task_id=task.id,
            occurred_at=task.date_done or task.created_at,
            amount=float(task.price or 0) * float(task.quantity or 1),
            provider_company_id=task.company_id,
            provider_company_name=(
                task.company.name if task.company else f"Company {task.company_id}"
            ),
        )
        for task in rows
    ]
