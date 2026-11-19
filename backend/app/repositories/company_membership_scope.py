from datetime import datetime,timezone
from sqlalchemy import exists,or_,and_
from sqlalchemy.orm import aliased
from app.models.company_membership import CompanyMembership
from app.models.user import User
from app.models.role import Role


def active_member_predicate(company_id):
    now=datetime.now(timezone.utc)
    member=aliased(CompanyMembership);previous=aliased(CompanyMembership)
    active=exists().where(member.user_id==User.id,member.company_id==company_id,member.status=="active",member.started_at<=now,or_(member.ended_at.is_(None),member.ended_at>now))
    history=exists().where(previous.user_id==User.id,previous.company_id==company_id)
    return or_(active,and_(User.company_id==company_id,~history))


def company_role_predicate(company_id,roles):
    now=datetime.now(timezone.utc);member=aliased(CompanyMembership);previous=aliased(CompanyMembership)
    classes=[code for code,name in {"admin":"admin","responsible":"manager","worker":"viewer"}.items() if name in roles]
    active=exists().where(member.user_id==User.id,member.company_id==company_id,member.status=="active",member.access_class.in_(classes),member.started_at<=now,or_(member.ended_at.is_(None),member.ended_at>now))
    history=exists().where(previous.user_id==User.id,previous.company_id==company_id)
    return or_(active,and_(User.company_id==company_id,~history,User.role.has(Role.name.in_(roles))))
