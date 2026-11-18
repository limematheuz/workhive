from app.models.company_hierarchy import CompanyHierarchy


def get(db,company):return db.get(CompanyHierarchy,company)
