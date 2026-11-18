from app.models.advisory_request import AdvisoryRequest


def rows(db,company,requester=None):
    query=db.query(AdvisoryRequest).filter_by(company_id=company)
    return query.filter_by(requested_by=requester) if requester is not None else query
