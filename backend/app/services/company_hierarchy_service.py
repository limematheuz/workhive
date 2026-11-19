from fastapi import HTTPException
from app.models.company_hierarchy import CompanyHierarchy
from app.repositories import company_hierarchy as repo,organization as organization_repo
from app.services.organization_authorization_service import require_capability
from app.services.consolidation_service import company_principal


def parent(db,company):
    row=repo.get(db,company)
    return row.parent_company_id if row else None


def save(db,user,company,parent_id):
    row=repo.get(db,company)
    if parent_id is None:
        if row:db.delete(row)
        return
    from app.services.entitlement_service import require_company_feature
    require_company_feature(db,company_id=company,code="features.corporate_structure")
    # Managing a relationship requires an administrative scope on both entities.
    membership=organization_repo.get_user_membership(db,company_id=parent_id,user_id=user.id)
    if not membership or membership.status!="active":raise HTTPException(403,"Necesitas acceso administrativo a ambas sociedades.")
    require_capability(db,company_principal(db,user,parent_id),"access.members.manage")
    require_company_feature(db,company_id=parent_id,code="features.corporate_structure")
    visited={company};cursor=parent_id
    while cursor is not None:
        if cursor in visited or len(visited)>100:raise HTTPException(409,"La relación crearía un ciclo en el grupo.")
        visited.add(cursor);cursor=parent(db,cursor)
    if row is None:row=CompanyHierarchy(company_id=company);db.add(row)
    row.parent_company_id=parent_id
