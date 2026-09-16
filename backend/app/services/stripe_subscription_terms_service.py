"""Parse auditable commercial terms from Stripe subscription metadata."""

from datetime import datetime, timezone
from typing import Any

from app.services import company_entitlement_service


def datetime_from_unix(timestamp: Any) -> datetime | None:
    if not timestamp:
        return None
    try:
        return datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return None


def commercial_terms_from_subscription(
    stripe_object: dict[str, Any],
) -> company_entitlement_service.CommercialSubscriptionTerms | None:
    """Accept a terms snapshot only from our explicit checkout metadata."""
    metadata = stripe_object.get("metadata")
    if not isinstance(metadata, dict):
        return None
    billing_interval = metadata.get("billing_interval")
    amount_cents = metadata.get("commercial_amount_cents")
    currency = metadata.get("commercial_currency")
    tax_behavior = metadata.get("commercial_tax_behavior")
    if (
        billing_interval not in {"monthly", "annual"}
        or tax_behavior not in {"exclusive", "inclusive"}
        or not isinstance(currency, str)
        or currency.upper() != "EUR"
    ):
        return None
    try:
        parsed_amount_cents = int(str(amount_cents))
    except (TypeError, ValueError):
        return None
    if parsed_amount_cents < 0:
        return None
    effective_at = (
        datetime_from_unix(stripe_object.get("start_date"))
        or datetime_from_unix(stripe_object.get("current_period_start"))
        or datetime.now(timezone.utc)
    )
    return company_entitlement_service.CommercialSubscriptionTerms(
        billing_interval=billing_interval,
        amount_cents=parsed_amount_cents,
        currency=currency.upper(),
        tax_behavior=tax_behavior,
        effective_at=effective_at,
    )
