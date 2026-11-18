"""Immutable tenant view over a durable identity; never an ORM persistence target."""
from datetime import datetime,timezone
from fastapi import HTTPException

INTERNAL_ROLES=frozenset({"admin","manager","viewer"})


def active_membership(membership):
    if membership is None or membership.status!="active":return False
    now=datetime.now(timezone.utc)
    utc=lambda value:value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value
    return (not membership.started_at or utc(membership.started_at)<=now) and (not membership.ended_at or utc(membership.ended_at)>now)


class CompanyUser:
    __slots__=("identity_user","active_membership","_company","_role","_session_version","_membership_session_version","initial_operational_role")

    def __init__(self,identity,membership,company,role,version):
        self.identity_user=identity;self.active_membership=membership;self._company=company;self._role=role;self._session_version=version
        self._membership_session_version=membership.session_version if membership is not None else 0
        self.initial_operational_role=None

    def __getattr__(self,name):
        if name.startswith("_sa_"):raise AttributeError(name)
        return getattr(self.identity_user,name)

    @property
    def company_id(self):return self._company.id

    @property
    def company(self):return self._company

    @property
    def role(self):return self._role

    @property
    def role_id(self):return self._role.id

    @property
    def base_company_id(self):return self.identity_user.company_id

    @property
    def session_version(self):return self._session_version

    @property
    def membership_session_version(self):return self._membership_session_version

    @property
    def work_sessions(self):
        return [s for s in self.identity_user.work_sessions if (s.company_id or s.labor_cost_company_id or self.base_company_id)==self.company_id]

    @property
    def active_location_id(self):
        session=next((s for s in sorted(self.work_sessions,key=lambda s:s.id or 0,reverse=True) if s.end_time is None),None)
        return session.location_id if session else None

    @property
    def active_location_name(self):
        session=next((s for s in sorted(self.work_sessions,key=lambda s:s.id or 0,reverse=True) if s.end_time is None),None)
        return session.location.name if session and session.location else None


def identity(user):return user.identity_user if isinstance(user,CompanyUser) else user


def bind(row,requested_company,version,membership_version=0):
    if row is None:return None
    user,membership,company,role=row
    if not user.role or user.role.name not in INTERNAL_ROLES:
        if requested_company is not None:raise HTTPException(403,"Este tipo de acceso utiliza sus propios espacios autorizados.")
        return user
    if membership is None:
        if requested_company is not None:raise HTTPException(403,"No tienes una membresía activa en esa empresa.")
        return CompanyUser(user,None,company,user.role,version) if company is not None else user
    if not active_membership(membership) or company is None or role is None:raise HTTPException(403,"La membresía de esta empresa ya no está activa.")
    if membership.session_version!=membership_version:
        raise HTTPException(401,"Este acceso de empresa ha cambiado. Inicia sesión de nuevo.",headers={"WWW-Authenticate":"Bearer"})
    return CompanyUser(user,membership,company,role,version)
