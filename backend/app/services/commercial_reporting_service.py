"""Read-only subscription lifecycle reporting for platform administrators."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import subscription_entitlement as entitlement_repo
from app.schemas.company_entitlement_management import (
    CommercialOverviewResponse,
    CommercialPlanOverviewResponse,
)
from app.services import company_entitlement_service
from app.services.entitlement_catalog import PLAN_CODES, plan_label
from app.services.user_scope import require_platform_superadmin


_PAYMENT_ATTENTION_STATUSES = frozenset({"past_due", "unpaid"})
_PLAN_ORDER = {code: index for index, code in enumerate(PLAN_CODES)}
_LIFECYCLE_WINDOW = timedelta(days=30)


def _as_mapping(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def _plan_change_direction(previous: str | None, current: str | None) -> int:
    """Return +1 for upgrade, -1 for downgrade and 0 for incomparable changes."""
    if previous not in _PLAN_ORDER or current not in _PLAN_ORDER:
        return 0
    return (_PLAN_ORDER[current] > _PLAN_ORDER[previous]) - (
        _PLAN_ORDER[current] < _PLAN_ORDER[previous]
    )


def _monthly_equivalent_cents(amount_cents: int, billing_interval: str) -> int:
    """Normalize an agreed recurring amount without pretending it is revenue."""
    if billing_interval == "monthly":
        return amount_cents
    return int(
        (Decimal(amount_cents) / Decimal(12)).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
    )


def get_commercial_overview(
    db: Session,
    current_user: User,
    *,
    now: datetime | None = None,
) -> CommercialOverviewResponse:
    """Summarize lifecycle and only the contracts with recorded terms.

    MRR is a contractual monthly equivalent, not issued-invoice or collected
    revenue.  Legacy rows without a terms snapshot are deliberately excluded.
    """
    require_platform_superadmin(current_user)
    current_time = now or datetime.now(timezone.utc)
    plan_counts: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "active_subscriptions": 0,
            "trial_subscriptions": 0,
            "payment_attention_subscriptions": 0,
            "inactive_subscriptions": 0,
            "contracted_mrr_cents": 0,
            "subscriptions_without_commercial_terms": 0,
        }
    )

    active_subscriptions = 0
    trial_subscriptions = 0
    payment_attention_subscriptions = 0
    contracted_mrr_cents = 0
    active_subscriptions_without_commercial_terms = 0
    active_subscriptions_with_commercial_terms = 0
    for subscription in entitlement_repo.list_current_company_subscriptions(db):
        plan_code = subscription.plan.code if subscription.plan else "custom"
        counts = plan_counts[plan_code]
        if subscription.status == "active":
            active_subscriptions += 1
            counts["active_subscriptions"] += 1
            commercial_terms = company_entitlement_service.subscription_commercial_terms(
                subscription
            )
            if commercial_terms is None:
                active_subscriptions_without_commercial_terms += 1
                counts["subscriptions_without_commercial_terms"] += 1
            else:
                active_subscriptions_with_commercial_terms += 1
                monthly_equivalent = _monthly_equivalent_cents(
                    commercial_terms.amount_cents,
                    commercial_terms.billing_interval,
                )
                contracted_mrr_cents += monthly_equivalent
                counts["contracted_mrr_cents"] += monthly_equivalent
        elif subscription.status == "trialing":
            trial_subscriptions += 1
            counts["trial_subscriptions"] += 1
        elif subscription.status in _PAYMENT_ATTENTION_STATUSES:
            payment_attention_subscriptions += 1
            counts["payment_attention_subscriptions"] += 1
        else:
            counts["inactive_subscriptions"] += 1

    upgrades = 0
    downgrades = 0
    churned = 0
    for audit in entitlement_repo.list_recent_subscription_audit(
        db,
        since=current_time - _LIFECYCLE_WINDOW,
    ):
        previous = _as_mapping(audit.previous_value)
        next_value = _as_mapping(audit.next_value)
        previous_plan = previous.get("plan_code")
        next_plan = next_value.get("plan_code")
        direction = _plan_change_direction(
            previous_plan if isinstance(previous_plan, str) else None,
            next_plan if isinstance(next_plan, str) else None,
        )
        if direction > 0:
            upgrades += 1
        elif direction < 0:
            downgrades += 1

        previous_status = previous.get("status")
        next_status = next_value.get("status")
        if (
            previous_status in {"active", "trialing", "past_due", "unpaid", "paused"}
            and next_status == "canceled"
        ):
            churned += 1

    plans = [
        CommercialPlanOverviewResponse(code=code, label=plan_label(code), **plan_counts[code])
        for code in PLAN_CODES
        if code in plan_counts
    ]
    return CommercialOverviewResponse(
        active_subscriptions=active_subscriptions,
        trial_subscriptions=trial_subscriptions,
        payment_attention_subscriptions=payment_attention_subscriptions,
        upgrades_last_30_days=upgrades,
        downgrades_last_30_days=downgrades,
        churned_last_30_days=churned,
        revenue_measurement_available=(
            active_subscriptions_with_commercial_terms > 0
        ),
        contracted_mrr_cents=contracted_mrr_cents,
        active_subscriptions_without_commercial_terms=(
            active_subscriptions_without_commercial_terms
        ),
        plans=plans,
    )
