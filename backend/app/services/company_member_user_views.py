from app.repositories import company_session as repo
from app.services.company_session_principal import CompanyUser,active_membership


def views(db,people,company_id):
    if company_id is None:return people
    memberships={m.user_id:(m,c,r) for m,c,r in repo.member_views(db,[p.id for p in people],company_id)}
    company=next((values[1] for values in memberships.values()),None)
    if company is None:company=repo.company(db,company_id)
    result=[]
    for person in people:
        values=memberships.get(person.id)
        if values and active_membership(values[0]):result.append(CompanyUser(person,*values,person.session_version))
        elif company is not None:result.append(CompanyUser(person,None,company,person.role,person.session_version))
        else:result.append(person)
    return result
