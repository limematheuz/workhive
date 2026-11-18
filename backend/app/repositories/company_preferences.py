from app.models.company_preferences import CompanyPreferences


def get(db, company):
    return db.get(CompanyPreferences, company)
