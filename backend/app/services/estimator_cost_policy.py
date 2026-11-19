from decimal import Decimal,InvalidOperation,ROUND_HALF_UP
from math import ceil
from app.services.labor_cost_snapshot_service import _worked_seconds

CENT=Decimal(".01")
ZERO=Decimal("0")


def money(value):return value.quantize(CENT,rounding=ROUND_HALF_UP)


def employee_rate(employee):
    from datetime import date
    profile=employee.profile or {}
    try:
        monthly=sum((Decimal(str(profile.get(key,0) or 0)) for key in ("gross","extra","bonus","insurance","other")),ZERO)
        hours=Decimal(str(employee.monthly_hours))
        if monthly>0 and hours>0:return monthly/hours,"Costes mensuales / horas contratadas"
        stored=Decimal(str(employee.hourly_cost or 0))
        if stored>0:return stored,"Coste por hora registrado en la ficha"
        periods=[key for key in (employee.history or {}) if key<=date.today().isoformat()[:7]]
        if periods:
            period=max(periods);entry=employee.history[period]
            cost=Decimal(str(entry.get("cost",0)));contracted=Decimal(str(entry.get("hours",0)))
            if cost>0 and contracted>0:return cost/contracted,"Último coste histórico registrado · "+period
    except (ValueError,InvalidOperation,TypeError):return None,"Coste pendiente"
    return None,"Coste pendiente"


def labor_lines(resolved):
    lines=[];missing=[];total=ZERO;minutes_total=0
    for entry in resolved:
        space=entry["space"];workers=entry["workers"];minutes=entry["minutes"]
        if not entry["tasks"]:missing.append(f"{space.name}: no hay tareas seleccionadas.")
        if not workers:missing.append(f"{space.name}: faltan trabajadores o equipo.")
        if minutes is None:missing.append(f"{space.name}: falta duración de tareas o previsión manual.")
        per_person=ceil(minutes/len(workers)) if minutes is not None and workers else None
        for employee in workers:
            rate,source=employee_rate(employee)
            if rate is None:missing.append(f"{employee.name}: falta el coste laboral.")
            amount=money(Decimal(per_person)/60*rate) if per_person is not None and rate is not None else None
            if amount is not None:total+=amount
            if per_person is not None:minutes_total+=per_person
            lines.append(dict(space_id=space.id,space=space.name,employee_id=employee.id,employee=employee.name,
                minutes=per_person,hourly_cost=money(rate) if rate is not None else None,cost=amount,
                cost_source=source,duration_source="Previsión manual" if entry["selection"].planned_minutes is not None else "Duraciones de las tareas de la ubicación"))
    return lines,missing,money(total),minutes_total


def historical_comparison(tasks,sessions,spaces,templates,company):
    matching=[task for task in tasks if {zone.zone_id for zone in task.zones}==spaces and
        {item.location_space_task_template_id for item in task.checklist_items if item.location_space_task_template_id is not None}==templates and all(item.location_space_task_template_id is not None for item in task.checklist_items)]
    logs={task.id:[] for task in matching}
    for session in sessions:
        if session.task_item_id in logs:logs[session.task_item_id].append(session)
    recorded=[entries for entries in logs.values() if entries]
    seconds=[sum(_worked_seconds(entry) for entry in entries) for entries in recorded]
    costed=[entries for entries in recorded if all(entry.labor_cost_amount_snapshot is not None and entry.labor_cost_company_id==company for entry in entries)]
    costs=[sum((Decimal(str(entry.labor_cost_amount_snapshot)) for entry in entries),ZERO) for entries in costed]
    return dict(sample_count=len(recorded),costed_sample_count=len(costed),
        average_person_hours=money(Decimal(sum(seconds))/len(seconds)/3600) if seconds else None,
        average_labor_cost=money(sum(costs,ZERO)/len(costs)) if costs else None,
        note="Últimas 50 ejecuciones completadas del centro en 180 días; se comparan solo los mismos espacios y tareas.")
