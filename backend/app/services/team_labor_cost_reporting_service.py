"""Read-only labour-cost reporting grouped by the frozen responsible team."""

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories import margin_forecast as forecast_repo
from app.schemas.margin_forecast import TeamLaborCostResponse
from app.services.margin_reporting_policy import money, require_margin_read_access


def list_team_labor_costs(
    db: Session, current_user: User
) -> list[TeamLaborCostResponse]:
    company_id = require_margin_read_access(db, current_user)
    return [
        TeamLaborCostResponse(
            team_id=team_id,
            team_name=team_name,
            work_session_count=session_count,
            actual_labor_cost_base_amount=money(total),
        )
        for team_id, team_name, total, session_count in (
            forecast_repo.list_team_labor_cost_summaries(db, company_id=company_id)
        )
    ]
