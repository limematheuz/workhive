from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.location_profile import LocationProfile
from app.models.location_access_profile import LocationAccessProfile
from app.models.location_zone import LocationSpaceTaskTemplate, LocationZone
from app.models.task_item import TaskItem
from app.models.task_structure import TaskChecklistItem
from app.repositories import location_workspace as workspace_repo
from app.schemas.location_workspace import (
    LocationProfileInput,
    LocationSpaceInput,
    LocationSpaceTaskTemplateInput,
    LocationSpaceTaskTemplateUpdate,
    LocationSpaceUpdate,
)
from app.schemas.location_access import LocationAccessInput
from app.services import location_catalog_service
from app.services.location_access_secret_service import encrypt_access_code


def sync_profile(
    db: Session,
    location: Location,
    company_id: int,
    profile_data: LocationProfileInput | None,
) -> None:
    if profile_data is None:
        return
    location_catalog_service.validate_profile(profile_data)
    profile = workspace_repo.get_profile(db, location.id)
    values = profile_data.model_dump()
    if profile is None:
        profile = LocationProfile(
            location_id=location.id,
            company_id=company_id,
            **values,
        )
        db.add(profile)
    else:
        for field, value in values.items():
            setattr(profile, field, value)
        db.add(profile)
    location.profile = profile


def sync_access_profile(
    db: Session,
    location: Location,
    access_data: LocationAccessInput | None,
) -> None:
    if access_data is None:
        return
    profile = workspace_repo.get_access_profile(db, location.id)
    values = access_data.model_dump(
        exclude_unset=True,
        exclude={"access_code", "clear_access_code"},
    )
    if profile is None:
        profile = LocationAccessProfile(
            location_id=location.id,
            permitted_days=values.pop("permitted_days", []),
            **values,
        )
        db.add(profile)
    else:
        for field, value in values.items():
            setattr(profile, field, value)
    if access_data.clear_access_code:
        profile.access_code_encrypted = None
    elif access_data.access_code:
        profile.access_code_encrypted = encrypt_access_code(access_data.access_code)
    db.add(profile)
    location.access_profile = profile


def _next_space_order(db: Session, location_id: int) -> int:
    spaces = workspace_repo.list_spaces(db, location_id, active_only=False)
    return (spaces[-1].sort_order + 1) if spaces else 0


def _add_tasks(
    db: Session,
    space: LocationZone,
    tasks: list[LocationSpaceTaskTemplateInput],
) -> None:
    for index, task in enumerate(tasks):
        db.add(
            LocationSpaceTaskTemplate(
                location_space_id=space.id,
                title=task.title,
                category=task.category,
                frequency=task.frequency,
                estimated_minutes=task.estimated_minutes,
                sort_order=index,
            )
        )


def create_space(
    db: Session,
    location_id: int,
    space_data: LocationSpaceInput,
) -> LocationZone:
    if space_data.parent_id is not None:
        parent = workspace_repo.get_space(db, location_id, space_data.parent_id)
        if parent is None or not parent.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Parent space must belong to this location")
    space = LocationZone(
        location_id=location_id,
        parent_id=space_data.parent_id,
        name=space_data.name,
        zone_type=space_data.space_type,
        attributes=space_data.attributes,
        sort_order=_next_space_order(db, location_id),
    )
    db.add(space)
    db.flush()
    _add_tasks(db, space, space_data.tasks)
    db.flush()
    return space


def create_spaces(
    db: Session,
    location_id: int,
    spaces: list[LocationSpaceInput],
) -> list[LocationZone]:
    if len(spaces) > 500:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="A location can contain at most 500 spaces")
    names = [space.name.casefold() for space in spaces]
    if len(names) != len(set(names)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Space names must be unique within a location")
    return [create_space(db, location_id, space) for space in spaces]


def update_space(
    db: Session,
    location_id: int,
    space_id: int,
    space_data: LocationSpaceUpdate,
) -> LocationZone:
    space = workspace_repo.get_space(db, location_id, space_id)
    if space is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location space not found")
    values = space_data.model_dump(exclude_unset=True)
    parent_id = values.get("parent_id")
    if parent_id is not None:
        if parent_id == space.id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="A space cannot be its own parent")
        parent = workspace_repo.get_space(db, location_id, parent_id)
        if parent is None or not parent.is_active:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Parent space must belong to this location")
    for field, value in values.items():
        if field == "space_type":
            field = "zone_type"
        setattr(space, field, value)
    db.add(space)
    db.flush()
    return space


def reorder_spaces(
    db: Session,
    location_id: int,
    space_ids: list[int],
) -> None:
    spaces = workspace_repo.list_spaces(db, location_id)
    current_ids = [space.id for space in spaces]
    if len(space_ids) != len(current_ids) or set(space_ids) != set(current_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="The reorder list must include every active location space exactly once",
        )

    spaces_by_id = {space.id: space for space in spaces}
    for sort_order, space_id in enumerate(space_ids):
        space = spaces_by_id[space_id]
        space.sort_order = sort_order
        db.add(space)
    db.flush()


def archive_space(db: Session, location_id: int, space_id: int) -> None:
    space = workspace_repo.get_space(db, location_id, space_id)
    if space is None or not space.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location space not found")
    if any(child.is_active for child in space.children):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Archive child spaces before their parent")
    space.is_active = False
    db.add(space)


def validate_task_space_ids(
    db: Session,
    location_id: int,
    space_ids: list[int],
) -> list[LocationZone]:
    requested_ids = list(dict.fromkeys(space_ids))
    if not requested_ids:
        return []
    spaces = workspace_repo.list_spaces(db, location_id)
    spaces_by_id = {space.id: space for space in spaces}
    if any(space_id not in spaces_by_id for space_id in requested_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every selected space must be active and belong to the task location",
        )
    return [spaces_by_id[space_id] for space_id in requested_ids]


def resolve_task_space_ids(
    zone_ids: list[int],
    space_ids: list[int],
) -> list[int]:
    """Accept the old zones field and the new spaces field without ambiguity."""
    unique_zone_ids = list(dict.fromkeys(zone_ids))
    unique_space_ids = list(dict.fromkeys(space_ids))
    if unique_zone_ids and unique_space_ids and set(unique_zone_ids) != set(unique_space_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="zone_ids and space_ids must refer to the same spaces when both are provided",
        )
    return unique_space_ids or unique_zone_ids


def validate_space_task_template_ids(
    db: Session,
    location_id: int,
    space_ids: list[int],
    template_ids: list[int],
) -> list[LocationSpaceTaskTemplate]:
    requested_ids = list(dict.fromkeys(template_ids))
    if not requested_ids:
        return []
    if not space_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Select the related spaces before selecting their task templates",
        )
    templates = workspace_repo.get_active_space_tasks_by_ids(db, location_id, requested_ids)
    templates_by_id = {template.id: template for template in templates}
    if len(templates_by_id) != len(requested_ids) or any(
        template.location_space_id not in space_ids for template in templates
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Every selected space task must belong to a selected space",
        )
    return [templates_by_id[template_id] for template_id in requested_ids]


def append_selected_space_tasks_to_checklist(
    db: Session,
    task: TaskItem,
    templates: list[LocationSpaceTaskTemplate],
) -> None:
    if not templates:
        return
    selected_spaces = {space.zone_id: space.name for space in task.zones}
    position = max((item.position for item in task.checklist_items), default=-1) + 1
    for template in templates:
        db.add(
            TaskChecklistItem(
                task_id=task.id,
                position=position,
                text=template.title,
                location_space_task_template_id=template.id,
                space_name=selected_spaces.get(template.location_space_id),
            )
        )
        position += 1
    db.flush()


def list_spaces(db: Session, location_id: int) -> list[LocationZone]:
    return workspace_repo.list_spaces(db, location_id)


def create_space_task_template(
    db: Session,
    location_id: int,
    space_id: int,
    task_data: LocationSpaceTaskTemplateInput,
) -> LocationSpaceTaskTemplate:
    space = workspace_repo.get_space(db, location_id, space_id)
    if space is None or not space.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location space not found")
    task = LocationSpaceTaskTemplate(
        location_space_id=space.id,
        title=task_data.title,
        category=task_data.category,
        frequency=task_data.frequency,
        estimated_minutes=task_data.estimated_minutes,
        sort_order=len(space.task_templates),
    )
    db.add(task)
    db.flush()
    return task


def update_space_task_template(
    db: Session,
    location_id: int,
    space_id: int,
    task_template_id: int,
    task_data: LocationSpaceTaskTemplateUpdate,
) -> LocationSpaceTaskTemplate:
    space = workspace_repo.get_space(db, location_id, space_id)
    if space is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location space not found")
    task = next((item for item in space.task_templates if item.id == task_template_id), None)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location space task not found")
    for field, value in task_data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.add(task)
    db.flush()
    return task


def archive_space_task_template(
    db: Session,
    location_id: int,
    space_id: int,
    task_template_id: int,
) -> None:
    space = workspace_repo.get_space(db, location_id, space_id)
    if space is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location space not found")
    task = next(
        (item for item in space.task_templates if item.id == task_template_id and item.is_active),
        None,
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location space task not found")
    task.is_active = False
    db.add(task)
    db.flush()
