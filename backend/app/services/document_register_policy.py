from fastapi import HTTPException
from app.repositories import document_register as repo
from app.services import client_authorization_service,location_access_service
from app.services.organization_authorization_service import require_capability,has_capability,permitted_location_ids
from app.services.entitlement_service import require_company_feature
from app.services.user_scope import require_company_context


def company_context(db,user,company_id=None):
    if user.role.name=="external_portal":
        from app.services.advisory_service import require_area
        if company_id is None:raise HTTPException(422,"Selecciona la empresa de gestoría.")
        require_area(db,user,company_id,"payroll")
        return company_id
    if user.role.name not in {"admin","manager","viewer"}:raise HTTPException(403,"Acceso documental interno requerido.")
    company=require_company_context(user)
    if company_id is not None and company_id!=company:raise HTTPException(403,"Empresa no autorizada.")
    return company


def authorize_owner(db,user,company,kind,id,manage=False):
    row=repo.owner(db,company,kind,id)
    if row is None:raise HTTPException(404,"Ficha documental no encontrada.")
    if kind=="staff":
        require_company_feature(db,company_id=company,code="features.hr")
        if user.role.name=="external_portal":
            from app.services.advisory_service import require_area
            require_area(db,user,company,"payroll")
            if manage:raise HTTPException(403,"La gestoría entrega nóminas desde su flujo autorizado.")
        elif manage:require_capability(db,user,"labor_costs.manage",scope_type="company")
        else:
            own=repo.own_employee(db,company,user.id)
            if not own or own.id!=id:require_capability(db,user,"labor_costs.read",scope_type="company")
    elif user.role.name=="external_portal":raise HTTPException(403,"El área laboral no concede acceso a documentos comerciales.")
    elif kind=="client":
        require_company_feature(db,company_id=company,code="features.clients")
        client_authorization_service.require_client_membership(db,user,"clients.manage" if manage else "clients.read")
    else:
        require_company_feature(db,company_id=company,code="features.locations")
        location_access_service.require_readable_location(db,user,id)
        if manage:require_capability(db,user,"locations.manage",scope_type="location",scope_id=id)
    return row


def scopes(db,user,company):
    allowed={"client":[],"location":[],"staff":[]};managed={key:set() for key in allowed};choices={key:[] for key in allowed}
    for kind in allowed:
        try:
            if kind=="staff":
                require_company_feature(db,company_id=company,code="features.hr")
                own=repo.own_employee(db,company,user.id)
                ids=None if user.role.name=="external_portal" or has_capability(db,user,"labor_costs.read",scope_type="company") else [own.id] if own else []
                people=repo.owners(db,company,kind,ids)
                manage=user.role.name!="external_portal" and has_capability(db,user,"labor_costs.manage",scope_type="company")
                managed[kind]={row.id for row in people} if manage else set()
            elif user.role.name=="external_portal":continue
            elif kind=="client":
                require_company_feature(db,company_id=company,code="features.clients")
                client_authorization_service.require_client_membership(db,user,"clients.read")
                people=repo.owners(db,company,kind)
                managed[kind]={row.id for row in people} if client_authorization_service.has_client_capability(db,user,"clients.manage") else set()
            else:
                require_company_feature(db,company_id=company,code="features.locations")
                people=repo.owners(db,company,kind,permitted_location_ids(db,user,"locations.read"))
                ids=permitted_location_ids(db,user,"locations.manage") if has_capability(db,user,"locations.manage") else []
                managed[kind]={row.id for row in people if ids is None or row.id in ids}
            allowed[kind]=[row.id for row in people]
            choices[kind]=people
        except HTTPException as exc:
            if exc.status_code not in {403,404}:raise
    return allowed,managed,choices


def can_manage(db,user,row):
    try:
        authorize_owner(db,user,row.company_id,row.owner_type,row.owner_id,True)
        return True
    except HTTPException as exc:
        if exc.status_code not in {403,404}:raise
        return False
