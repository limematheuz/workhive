from sqlalchemy import select,func,and_,case,or_,exists
from sqlalchemy.orm import aliased,contains_eager
from app.models.user import User
from app.models.role import Role
from app.models.company import Company
from app.models.company_membership import CompanyMembership
from app.models.work_session import WorkSession
from app.models.task_item import TaskItem
from app.repositories.user import user_response_load_options


def authentication_statement(email,company_id=None):
    active_role=aliased(Role);base_role=aliased(Role);base_company=aliased(Company)
    company_key=User.company_id if company_id is None else company_id
    role_name=case({"admin":"admin","responsible":"manager","worker":"viewer"},value=CompanyMembership.access_class)
    return select(User,CompanyMembership,Company,active_role).select_from(User).outerjoin(CompanyMembership,and_(CompanyMembership.user_id==User.id,CompanyMembership.company_id==company_key)).outerjoin(Company,Company.id==company_key).outerjoin(active_role,active_role.name==role_name).outerjoin(base_role,base_role.id==User.role_id).outerjoin(base_company,base_company.id==User.company_id).options(contains_eager(User.role,alias=base_role),contains_eager(User.company,alias=base_company),*user_response_load_options(identity_relationships=False)).where(func.lower(User.email)==email.strip().lower())


def authenticate(db,email,company_id=None):return db.execute(authentication_statement(email,company_id)).first()


async def authenticate_async(db,email,company_id=None):return (await db.execute(authentication_statement(email,company_id))).first()


def contexts(db,user_id):
    return db.query(CompanyMembership,Company).join(Company,Company.id==CompanyMembership.company_id).filter(CompanyMembership.user_id==user_id,CompanyMembership.status=="active",Company.is_active.is_(True)).order_by(Company.name,Company.id).all()


def membership(db,user_id,company_id):
    return db.query(CompanyMembership).filter_by(user_id=user_id,company_id=company_id).populate_existing().with_for_update().first()


def lock_identity(db,user_id):return db.query(User).filter_by(id=user_id).populate_existing().with_for_update().one()


def company(db,id):return db.get(Company,id)


def member_views(db,user_ids,company_id):
    role_name=case({"admin":"admin","responsible":"manager","worker":"viewer"},value=CompanyMembership.access_class)
    return db.query(CompanyMembership,Company,Role).select_from(CompanyMembership).join(Company,Company.id==CompanyMembership.company_id).join(Role,Role.name==role_name).filter(CompanyMembership.user_id.in_(user_ids),CompanyMembership.company_id==company_id).all() if user_ids else []


def active_work_companies(db,user_id):
    return {row[0] for row in db.query(func.coalesce(WorkSession.company_id,TaskItem.company_id,WorkSession.labor_cost_company_id,User.company_id)).join(User,User.id==WorkSession.user_id).outerjoin(TaskItem,TaskItem.id==WorkSession.task_item_id).filter(WorkSession.user_id==user_id,WorkSession.end_time.is_(None)).all()}
