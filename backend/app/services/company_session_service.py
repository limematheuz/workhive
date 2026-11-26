from fastapi import HTTPException
from app.core.security import create_access_token
from app.models.audit_log import AuditLog
from app.repositories import company_session as repo
from app.services.company_session_principal import identity,bind,active_membership,INTERNAL_ROLES,CompanyUser
from app.services.subscription_policy import require_company_access
from app.services.user_scope import is_platform_superadmin


def _internal(user):
    person=identity(user)
    if not person.role or person.role.name not in INTERNAL_ROLES:raise HTTPException(403,"El cambio de empresa requiere una identidad interna.")
    return person


def options(db,user):
    person=_internal(user)
    active_work=repo.active_work_companies(db,person.id)
    choices=[]
    for membership,company in repo.contexts(db,person.id):
        if not active_membership(membership):continue
        reason=None
        try:require_company_access(company)
        except HTTPException:reason="Revisa la suscripción de esta empresa."
        if active_work and active_work!={company.id}:reason="Finaliza tu jornada abierta antes de cambiar de empresa."
        choices.append(dict(id=company.id,name=company.name,access_class=membership.access_class,disabled=reason is not None,disabled_reason=reason))
    # A legacy identity may not have entered a canonical lifecycle yet. It can
    # see its present base, but switching always requires an actual membership.
    if not choices and person.company and person.company.is_active:
        choices.append(dict(id=person.company_id,name=person.company.name,access_class=None,disabled=True,disabled_reason="Configura la membresía de la empresa para cambiar de contexto."))
    return dict(current_company_id=user.company_id,companies=choices)


def switch(db,user,company_id):
    person=_internal(user);version=user.session_version
    try:
        person=repo.lock_identity(db,person.id)
        if person.session_version!=version:raise HTTPException(401,"La sesión ha cambiado. Inicia sesión de nuevo.")
        membership=repo.membership(db,person.id,company_id)
        if not active_membership(membership):raise HTTPException(403,"No tienes una membresía activa en esa empresa.")
        company=membership.company
        require_company_access(company)
        active_work=repo.active_work_companies(db,person.id)
        if active_work and active_work!={company_id}:raise HTTPException(409,"Finaliza tu jornada abierta antes de cambiar de empresa.")
        token=create_access_token({"sub":person.email,"ver":version,"company_id":company_id,"membership_version":membership.session_version})
        db.add(AuditLog(company_id=company_id,actor_user_id=person.id,action="auth.company_changed",entity_type="session",entity_id=str(person.id),details={"from_company_id":user.company_id,"to_company_id":company_id}));db.commit()
        return dict(access_token=token,token_type="bearer",company_id=company_id,company_name=company.name,landing_path="/worker" if membership.access_class=="worker" else "/dashboard")
    except Exception:db.rollback();raise


def login_context(db,user):
    if not user.role or user.role.name not in INTERNAL_ROLES:return user
    contexts=repo.contexts(db,user.id)
    candidates=sorted(contexts,key=lambda pair:(pair[0].company_id!=user.company_id,pair[1].name))
    fallback=None
    for membership,company in candidates:
        if not active_membership(membership):continue
        if fallback is None:
            fallback = (membership, company)
        try:require_company_access(company)
        except HTTPException:continue
        return bind(repo.authenticate(db,user.email,company.id),company.id,user.session_version,membership.session_version)
    if fallback is not None:
        membership,company=fallback
        return bind(repo.authenticate(db,user.email,company.id),company.id,user.session_version,membership.session_version)
    return user


def token_claims(user):
    claims={"sub":user.email,"ver":user.session_version}
    if is_platform_superadmin(user):
        claims.update(session_scope="platform", platform_user_id=user.id)
        return claims
    if isinstance(user,CompanyUser) and user.active_membership is not None:
        claims.update(company_id=user.company_id,membership_version=user.membership_session_version)
    return claims
