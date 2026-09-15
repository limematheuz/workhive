"""Shared access and monetary rules for profitability reporting."""

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.entitlement_service import require_company_feature
from app.services.organization_authorization_service import require_capability
from app.services.user_scope import require_company_context


MONEY = Decimal("0.01")


def money(value: Decimal | object) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def require_margin_read_access(db: Session, current_user: User) -> int:
    company_id = require_company_context(current_user)
    require_company_feature(db, company_id=company_id, code="features.profitability")
    require_capability(db, current_user, "finance.read")
    # A margin includes internal labour snapshots; never disclose them through
    # the broader finance reader capability alone.
    require_capability(db, current_user, "labor_costs.read")
    return company_id


def require_margin_manage_access(db: Session, current_user: User) -> int:
    company_id = require_margin_read_access(db, current_user)
    require_capability(db, current_user, "finance.manage")
    return company_id
