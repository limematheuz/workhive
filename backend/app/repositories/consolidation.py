from app.models.company import Company
from app.models.company_membership import CompanyMembership


def companies(db,user):
    return (db.query(Company).join(CompanyMembership,CompanyMembership.company_id==Company.id)
            .filter(CompanyMembership.user_id==user.id,CompanyMembership.status=="active",
                    Company.is_active.is_(True)).order_by(Company.id).all())


def metadata(db,ids):
    from app.models.company_preferences import CompanyPreferences
    from app.models.company_hierarchy import CompanyHierarchy
    preferences={p.company_id:p for p in db.query(CompanyPreferences).filter(CompanyPreferences.company_id.in_(ids))}
    parents={p.company_id:p.parent_company_id for p in db.query(CompanyHierarchy).filter(CompanyHierarchy.company_id.in_(ids))}
    return preferences,parents
