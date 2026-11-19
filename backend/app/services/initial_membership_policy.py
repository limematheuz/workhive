"""Initial operational access comes from this verified membership, never its identity's role."""
from app.services.company_session_principal import CompanyUser,active_membership
from app.repositories import organization as repo
from app.services.organization_legacy_authorization_service import legacy_role_allows

WORKER=frozenset({"locations.read","work.read","time.manage"})
RESPONSIBLE=frozenset({"locations.read","locations.manage","work.read","work.manage","time.read","time.manage","time.approve","inventory.read","inventory.manage"})


def capabilities(db,user,membership=None,has_explicit_assignments=None):
    if not isinstance(user,CompanyUser) or user.base_company_id==user.company_id:return None
    member=membership or user.active_membership
    if not active_membership(member) or member.user_id!=user.id or member.company_id!=user.company_id:return None
    if member.access_class not in {"worker","responsible"} or member.permissions_configured:return None
    expected="viewer" if member.access_class=="worker" else "manager"
    if user.role.name!=expected:return None
    history=has_explicit_assignments if has_explicit_assignments is not None else repo.has_profile_assignment_history(db,company_id=member.company_id,membership_id=member.id)
    if history:return None
    user.initial_operational_role=member.access_class
    return WORKER if member.access_class=="worker" else RESPONSIBLE


def operational_role_allows(db,user,capability,*,company_id,membership,has_explicit_assignments=None):
    initial=capabilities(db,user,membership,has_explicit_assignments)
    if initial is not None:return capability in initial
    return legacy_role_allows(db,user,capability,company_id=company_id,membership=membership,has_explicit_assignments=has_explicit_assignments)


def is_initial_worker(db,user):return capabilities(db,user)==WORKER
