from sqlalchemy import func
from app.models.client import Client
from app.models.location import Location
from app.models.staff_employee import StaffEmployee
from app.models.template_task import TemplateTask
from app.models.workforce_plan import WorkCrew
MODELS={"client":Client,"location":Location,"employee":StaffEmployee,"service":TemplateTask,"crew":WorkCrew}
def named(db,company,kind,name):
    model=MODELS[kind];column=model.owner_company_id if kind=="location" else model.company_id
    return db.query(model).filter(column==company,func.lower(model.name)==name.strip().lower()).limit(2).all()
