from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import AuthenticatedAdmin, AuthenticatedUser, get_db
from app.models.company import Company
from app.models.user import User
from app.schemas.billing import CheckoutSessionCreate, HostedBillingUrl, SubscriptionSummary
from app.services import billing_service
from app.services.subscription_policy import active_user_limit, evaluate_company_access


router = APIRouter()


def _current_company(db: Session, current_user: User) -> Company:
    if not current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The current user does not belong to a company",
        )
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )
    return company


@router.get("/subscription", response_model=SubscriptionSummary)
def subscription_summary(
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedUser,
):
    company = _current_company(db, current_user)
    access = evaluate_company_access(company)
    active_users = (
        db.query(User)
        .filter(
            User.company_id == company.id,
            User.is_active.is_(True),
        )
        .count()
    )
    return SubscriptionSummary(
        plan=company.subscription_plan,
        status=company.subscription_status,
        trial_ends_at=company.trial_ends_at.isoformat() if company.trial_ends_at else None,
        access_allowed=access.allowed,
        access_reason=access.reason,
        active_users=active_users,
        max_active_users=active_user_limit(company.subscription_plan),
    )


@router.post("/checkout", response_model=HostedBillingUrl)
def create_checkout(
    checkout: CheckoutSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedAdmin,
):
    company = _current_company(db, current_user)
    return HostedBillingUrl(
        url=billing_service.create_checkout_session(company, checkout.plan)
    )


@router.post("/portal", response_model=HostedBillingUrl)
def create_portal(
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedAdmin,
):
    company = _current_company(db, current_user)
    return HostedBillingUrl(url=billing_service.create_customer_portal(company))


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
    db: Session = Depends(get_db),
):
    event_type = billing_service.process_webhook(
        db,
        await request.body(),
        stripe_signature,
    )
    return {"received": True, "type": event_type}
