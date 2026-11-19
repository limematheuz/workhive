from app.repositories import company_recipients as repo
from app.services.company_session_principal import CompanyUser


def recipients(db,companies,role_names=None,user_ids=None):
    return [CompanyUser(user,member,company,role,user.session_version) for user,member,company,role in repo.rows(db,companies,role_names,user_ids)]
