from fastapi import HTTPException
from app.repositories import workforce_plan as repo


def resolve(db,company,location,selections,selected_spaces=None,selected_templates=None,*,require_duration=True):
    spaces={space.id:space for space in repo.spaces(db,location)}
    ids=[selection.space_id for selection in selections]
    if len(set(ids))!=len(ids) or not set(ids)<=spaces.keys():raise HTTPException(422,"Selecciona espacios activos de esta ubicación.")
    if selected_spaces is not None and set(ids)!=set(selected_spaces):raise HTTPException(422,"El reparto debe corresponder a los espacios seleccionados.")
    template_ids={id for selection in selections for id in selection.task_ids}
    templates={template.id:template for template in repo.templates(db,template_ids)}
    if set(templates)!=template_ids:raise HTTPException(422,"Revisa las tareas seleccionadas.")
    if selected_templates is not None and template_ids!={item.id for item in selected_templates}:raise HTTPException(422,"El reparto y las tareas seleccionadas no coinciden.")
    crew_ids={selection.crew_id for selection in selections if selection.crew_id is not None}
    crews={crew.id:crew for crew in repo.crews(db,company).filter_by(is_active=True).all() if crew.id in crew_ids}
    if set(crews)!=crew_ids:raise HTTPException(422,"Selecciona equipos activos de esta empresa.")
    members=repo.members(db,crew_ids)
    people={employee.id:employee for employee in repo.people(db,company).all()}
    result=[]
    for selection in selections:
        tasks=[templates[id] for id in selection.task_ids]
        if any(task.location_space_id!=selection.space_id for task in tasks):raise HTTPException(422,"Cada tarea debe pertenecer a su espacio.")
        worker_ids=selection.employee_ids if selection.crew_id is None else [m.employee_id for m in members if m.crew_id==selection.crew_id]
        if selection.crew_id is not None and not worker_ids:raise HTTPException(422,"El equipo seleccionado no tiene miembros.")
        if not set(worker_ids)<=people.keys() or any((people[id].profile or {}).get("state")=="Baja" for id in worker_ids):raise HTTPException(422,"Selecciona trabajadores activos de esta empresa.")
        minutes=selection.planned_minutes
        if minutes is None and tasks and all(task.estimated_minutes for task in tasks):minutes=sum(task.estimated_minutes for task in tasks)
        if require_duration and worker_ids and minutes is None:raise HTTPException(422,f"Indica la duración de {spaces[selection.space_id].name} o completa la duración de sus tareas.")
        current=spaces[selection.space_id];parts=[current.name];visited={current.id}
        while current.parent_id in spaces and current.parent_id not in visited:
            current=spaces[current.parent_id];visited.add(current.id);parts.insert(0,current.name)
        if len(parts)==1 and (spaces[selection.space_id].attributes or {}).get("floor"):
            parts.insert(0,str(spaces[selection.space_id].attributes["floor"]))
        label=" / ".join(parts)
        if len(label)>100:label="…"+label[-99:]
        result.append(dict(selection=selection,space=spaces[selection.space_id],space_label=label,tasks=tasks,workers=[people[id] for id in sorted(set(worker_ids))],minutes=minutes))
    return result
