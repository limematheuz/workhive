"""Read-only portal view over one durable identity and one authorized grant."""
from dataclasses import dataclass


@dataclass(frozen=True)
class PortalUser:
    identity_user: object
    context_role: object
    application_kind: str
    application_grant_id: int
    application_company_id: int
    application_grant_version: int

    def __getattr__(self, name):
        if name.startswith("_sa_"):
            raise AttributeError(name)
        return getattr(self.identity_user, name)

    @property
    def role(self):
        return self.context_role

    @property
    def role_id(self):
        return self.context_role.id

    @property
    def company(self):
        return None

    @property
    def company_id(self):
        return None

    @property
    def base_company_id(self):
        return None

    @property
    def session_version(self):
        return self.identity_user.session_version

    @property
    def work_sessions(self):
        return []

    @property
    def active_location_id(self):
        return None

    @property
    def active_location_name(self):
        return None


def durable_identity(user):
    """Identity-only auth workflows; ordinary data services retain portal scope."""
    from app.services.company_session_principal import CompanyUser
    return user.identity_user if isinstance(user, (CompanyUser, PortalUser)) else user
