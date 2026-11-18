from datetime import date,datetime,timezone
from fastapi import HTTPException
from app.repositories import accounting_period as repo


def utc_month(value):
    if isinstance(value,datetime):
        value=value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value,date):value=datetime.now(timezone.utc)
    return value.strftime("%Y-%m")


def assert_open(db,company,*dates):
    if not company:raise HTTPException(409,"Falta la empresa de la operación contable.")
    state=db.info.setdefault("accounting_period_guard",{})
    if company not in state:
        if repo.lock_company(db,company) is None:raise HTTPException(404,"Empresa no encontrada.")
        state[company]=repo.closed_months(db,company)
    for value in dates:
        month=utc_month(value)
        if month in state[company]:
            raise HTTPException(409,f"El periodo contable {month} está cerrado. Un administrador debe reabrirlo indicando el motivo antes de modificar sus registros.",headers={"X-WorkHive-Error-Code":"accounting.period_closed"})


def reset(db,*_):
    db.info.pop("accounting_period_guard",None)
