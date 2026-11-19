from sqlalchemy import and_,case
from sqlalchemy.orm import aliased
from app.models.user import User
from app.models.company import Company
from app.models.role import Role
from app.models.company_membership import CompanyMembership
from app.repositories.company_membership_scope import active_member_predicate


def rows(db,companies,role_names=None,user_ids=None):
    if not companies or user_ids is not None and not user_ids:return []
    member=aliased(CompanyMembership);base_role=aliased(Role);active_role=aliased(Role)
    membership_role=case({"admin":"admin","responsible":"manager","worker":"viewer"},value=member.access_class)
    role_name=case((member.id.is_not(None),membership_role),else_=base_role.name)
    query=db.query(User,member,Company,active_role).select_from(Company).join(User,User.is_active.is_(True)).join(base_role,base_role.id==User.role_id).outerjoin(member,and_(member.user_id==User.id,member.company_id==Company.id)).join(active_role,active_role.name==role_name).filter(Company.id.in_(companies),active_member_predicate(Company.id),base_role.name.in_({"admin","manager","viewer"}))
    if role_names is not None:query=query.filter(active_role.name.in_(role_names))
    if user_ids is not None:query=query.filter(User.id.in_(user_ids))
    return query.order_by(Company.id,User.id).all()
