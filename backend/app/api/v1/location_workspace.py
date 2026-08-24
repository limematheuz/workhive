from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import ActiveManagerOrAdmin, ActiveUser, get_db
from app.models.user import User
from app.schemas.location_workspace import (
    LocationBulkImportPreview,
    LocationBulkImportRequest,
    LocationBulkImportResult,
    LocationCatalogSuggestionRequest,
    LocationCatalogSuggestionResponse,
    LocationSpaceInput,
    LocationSpaceReorderRequest,
    LocationSpaceResponse,
    LocationSpaceTaskTemplateInput,
    LocationSpaceTaskTemplateResponse,
    LocationSpaceTaskTemplateUpdate,
    LocationSpaceUpdate,
)
from app.services import (
    location_access_service,
    location_catalog_service,
    location_import_service,
    location_workspace_service,
    location_workspace_mutation_service,
)
from app.services.user_scope import scoped_company_id


router = APIRouter()


@router.get("/catalog")
def read_location_catalog(current_user: User = ActiveUser):
    del current_user
    return location_catalog_service.get_catalog()


@router.post("/space-suggestions", response_model=LocationCatalogSuggestionResponse)
def get_space_suggestions(
    request: LocationCatalogSuggestionRequest,
    current_user: User = ActiveManagerOrAdmin,
):
    del current_user
    return location_catalog_service.suggest_spaces(request.site_type, request.attributes)


@router.post("/import/preview", response_model=LocationBulkImportPreview)
def preview_location_import(
    request: LocationBulkImportRequest,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return location_import_service.preview_import(
        db,
        scoped_company_id(current_user),
        request.csv_content,
    )


@router.post(
    "/import",
    response_model=LocationBulkImportResult,
    status_code=status.HTTP_201_CREATED,
)
def import_locations(
    request: LocationBulkImportRequest,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    return location_import_service.import_locations(
        db,
        scoped_company_id(current_user),
        request.csv_content,
    )


@router.get("/{location_id}/spaces", response_model=list[LocationSpaceResponse])
def read_location_spaces(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveUser,
):
    location_access_service.require_accessible_location(db, current_user, location_id)
    return location_workspace_service.list_spaces(db, location_id)


@router.post(
    "/{location_id}/spaces",
    response_model=LocationSpaceResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_location_space(
    location_id: int,
    space_data: LocationSpaceInput,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_workspace_mutation_service.create_space(db, location_id, space_data)


@router.put("/{location_id}/spaces/order", status_code=status.HTTP_204_NO_CONTENT)
def reorder_location_spaces(
    location_id: int,
    request: LocationSpaceReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    location_workspace_mutation_service.reorder_spaces(db, location_id, request)


@router.patch("/{location_id}/spaces/{space_id}", response_model=LocationSpaceResponse)
def update_location_space(
    location_id: int,
    space_id: int,
    space_data: LocationSpaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_workspace_mutation_service.update_space(
        db,
        location_id,
        space_id,
        space_data,
    )


@router.delete("/{location_id}/spaces/{space_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_location_space(
    location_id: int,
    space_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    location_workspace_mutation_service.archive_space(db, location_id, space_id)


@router.post(
    "/{location_id}/spaces/{space_id}/tasks",
    response_model=LocationSpaceTaskTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_space_task_template(
    location_id: int,
    space_id: int,
    task_data: LocationSpaceTaskTemplateInput,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_workspace_mutation_service.create_space_task_template(
        db,
        location_id,
        space_id,
        task_data,
    )


@router.patch(
    "/{location_id}/spaces/{space_id}/tasks/{task_template_id}",
    response_model=LocationSpaceTaskTemplateResponse,
)
def update_space_task_template(
    location_id: int,
    space_id: int,
    task_template_id: int,
    task_data: LocationSpaceTaskTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    return location_workspace_mutation_service.update_space_task_template(
        db,
        location_id,
        space_id,
        task_template_id,
        task_data,
    )


@router.delete(
    "/{location_id}/spaces/{space_id}/tasks/{task_template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def archive_space_task_template(
    location_id: int,
    space_id: int,
    task_template_id: int,
    db: Session = Depends(get_db),
    current_user: User = ActiveManagerOrAdmin,
):
    location_access_service.require_location_owner(db, current_user, location_id)
    location_workspace_mutation_service.archive_space_task_template(
        db,
        location_id,
        space_id,
        task_template_id,
    )
