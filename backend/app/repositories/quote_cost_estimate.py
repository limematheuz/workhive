from app.models.quote import Quote
from app.models.quote_cost_estimate import QuoteCostEstimate
from app.models.margin_forecast import MarginForecast


def quote(db,company,quote_id):
    return db.query(Quote).filter_by(company_id=company,id=quote_id,is_active=True).with_for_update().first()


def estimate(db,company,quote_id):
    return db.query(QuoteCostEstimate).filter_by(company_id=company,quote_id=quote_id).first()


def contract_budget(db,contract_id):
    return db.query(MarginForecast).filter_by(service_contract_id=contract_id).first()
