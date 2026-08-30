from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.api.deps import (
    AuthenticatedAdmin,
    AsyncAuthenticatedUser,
    get_async_db,
    get_db,
)
from app.core.config import settings
from app.core.rate_limit import enforce_rate_limit
from app.models.company import Company
from app.models.user import User
from app.schemas.billing import (
    CompanyPurchaseActivation,
    CompanyPurchaseActivationResponse,
    CompanyPurchaseCheckout,
    CheckoutSessionCreate,
    HostedBillingUrl,
    SubscriptionSummary,
)
from app.services import (
    audit_service,
    billing_service,
    company_purchase_activation_service,
    entitlement_service,
)
from app.services.subscription_policy import evaluate_company_access


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
async def subscription_summary(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = AsyncAuthenticatedUser,
):
    return await db.run_sync(
        lambda sync_db: _subscription_summary(sync_db, current_user)
    )


def _subscription_summary(db: Session, current_user: User) -> SubscriptionSummary:
    company = _current_company(db, current_user)
    access = evaluate_company_access(company)
    entitlements = entitlement_service.resolve_effective_entitlements(db, company)
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
        trial_ends_at=company.trial_ends_at.isoformat()
        if company.trial_ends_at
        else None,
        access_allowed=access.allowed,
        access_reason=access.reason,
        active_users=active_users,
        internal_member_limits={
            "administrators": int(entitlements.values["limits.internal_admins"]),
            "responsibles": int(entitlements.values["limits.internal_responsibles"]),
            "workers": int(entitlements.values["limits.internal_workers"]),
        },
    )


@router.post("/checkout", response_model=HostedBillingUrl)
def create_checkout(
    checkout: CheckoutSessionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedAdmin,
):
    enforce_rate_limit(
        request,
        "billing-checkout",
        settings.BILLING_SESSION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    company = _current_company(db, current_user)
    return HostedBillingUrl(
        url=billing_service.create_checkout_session(company, checkout.plan)
    )


@router.post(
    "/purchases/checkout",
    status_code=status.HTTP_201_CREATED,
    response_model=HostedBillingUrl,
)
def create_company_purchase_checkout(
    checkout: CompanyPurchaseCheckout,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        "company-purchase-checkout",
        settings.BILLING_SESSION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(checkout.owner_email),
    )
    return HostedBillingUrl(
        url=billing_service.create_company_purchase_checkout(db, checkout)
    )


@router.post("/purchases/activate", response_model=CompanyPurchaseActivationResponse)
def activate_company_purchase(
    activation: CompanyPurchaseActivation,
    request: Request,
    db: Session = Depends(get_db),
):
    enforce_rate_limit(
        request,
        "company-purchase-activation",
        settings.BILLING_SESSION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=activation.token,
    )
    company, owner = company_purchase_activation_service.activate_paid_purchase(
        db,
        payload=activation,
        request=request,
    )
    audit_service.record_event(
        db,
        actor=owner,
        company_id=company.id,
        action="company.purchase_activated",
        entity_type="company_purchase",
        entity_id=company.id,
        request=request,
        details={"plan": company.subscription_plan},
    )
    return CompanyPurchaseActivationResponse(status="activated", company_id=company.id)


@router.post("/portal", response_model=HostedBillingUrl)
def create_portal(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = AuthenticatedAdmin,
):
    enforce_rate_limit(
        request,
        "billing-portal",
        settings.BILLING_SESSION_RATE_LIMIT,
        settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        identity=str(current_user.id),
    )
    company = _current_company(db, current_user)
    return HostedBillingUrl(url=billing_service.create_customer_portal(company))


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_async_db),
):
    payload = await request.body()
    event_type = await db.run_sync(
        lambda sync_db: billing_service.process_webhook(
            sync_db,
            payload,
            stripe_signature,
        )
    )
    return {"received": True, "type": event_type}
