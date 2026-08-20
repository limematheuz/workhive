from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.models.company import Company
from app.models.company_fiscal_settings import CompanyFiscalSettings
from app.models.user import User


def list_companies_with_fiscal_reminders(db: Session) -> list[CompanyFiscalSettings]:
    """Load only active companies which explicitly enabled an obligation."""
    return (
        db.query(CompanyFiscalSettings)
        .join(CompanyFiscalSettings.company)
        .options(
            selectinload(CompanyFiscalSettings.company)
            .selectinload(Company.users)
            .selectinload(User.role)
        )
        .filter(
            Company.is_active.is_(True),
            or_(
                CompanyFiscalSettings.quarterly_vat_enabled.is_(True),
                CompanyFiscalSettings.quarterly_withholding_enabled.is_(True),
            ),
        )
        .order_by(CompanyFiscalSettings.company_id.asc())
        .all()
    )
