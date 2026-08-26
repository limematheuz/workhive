from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.location import Location
from app.models.location_template import LocationTemplate
from app.models.template_task import TemplateTask
from app.models.user import User
from app.schemas.company import (
    CompanyOnboardingComplete,
    CompanyOnboardingResponse,
)
from app.schemas.location import LocationCreate
from app.services import location_service


@dataclass(frozen=True)
class StarterService:
    name: str
    description: str


STARTER_SERVICES = {
    "service_provider": StarterService(
        name="Limpieza estándar",
        description=(
            "- [ ] Ventilar y retirar residuos\n"
            "- [ ] Limpiar y desinfectar baños\n"
            "- [ ] Limpiar cocina y superficies\n"
            "- [ ] Aspirar y fregar suelos\n"
            "- [ ] Revisar consumibles y reportar incidencias"
        ),
    ),
    "property_manager": StarterService(
        name="Limpieza de salida",
        description=(
            "- [ ] Ventilar y retirar residuos\n"
            "- [ ] Limpiar cocina y electrodomésticos\n"
            "- [ ] Limpiar y desinfectar baños\n"
            "- [ ] Cambiar ropa de cama y toallas\n"
            "- [ ] Aspirar y fregar suelos\n"
            "- [ ] Revisar consumibles y reportar incidencias"
        ),
    ),
    "hybrid": StarterService(
        name="Limpieza operativa",
        description=(
            "- [ ] Revisar el estado inicial del espacio\n"
            "- [ ] Limpiar y desinfectar baños\n"
            "- [ ] Limpiar cocina y superficies\n"
            "- [ ] Aspirar y fregar suelos\n"
            "- [ ] Reponer consumibles\n"
            "- [ ] Fotografiar y reportar incidencias"
        ),
    ),
}


def complete_company_onboarding(
    db: Session,
    company_id: int,
    data: CompanyOnboardingComplete,
    current_user: User,
) -> CompanyOnboardingResponse:
    if current_user.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding can only be configured for your own company",
        )

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found",
        )

    existing_location = (
        db.query(Location)
        .filter(
            Location.owner_company_id == company_id,
            Location.is_active.is_(True),
        )
        .order_by(Location.id.asc())
        .first()
    )
    if company.onboarding_completed and (existing_location or not data.location):
        if company.operating_model != data.operating_model:
            company.operating_model = data.operating_model
            db.add(company)
            db.commit()
        existing_template = None
        if existing_location:
            existing_template = (
                db.query(TemplateTask)
                .join(LocationTemplate)
                .filter(
                    LocationTemplate.location_id == existing_location.id,
                    TemplateTask.company_id == company_id,
                    TemplateTask.is_active.is_(True),
                )
                .order_by(TemplateTask.id.asc())
                .first()
            )
        return CompanyOnboardingResponse(
            onboarding_completed=True,
            operating_model=company.operating_model or data.operating_model,
            created=False,
            location_id=existing_location.id if existing_location else None,
            location_name=existing_location.name if existing_location else None,
            template_task_id=existing_template.id if existing_template else None,
            template_name=existing_template.name if existing_template else None,
        )

    starter = STARTER_SERVICES[data.operating_model]
    location = None
    template = None

    try:
        company.operating_model = data.operating_model
        company.onboarding_completed = True

        if data.location:
            location = location_service.create_location_in_transaction(
                db,
                company_id,
                LocationCreate(
                    **data.location.model_dump(),
                    client_id=None,
                    default_service_provider_id=None,
                    is_active=True,
                ),
            )

            template = (
                db.query(TemplateTask)
                .filter(
                    TemplateTask.company_id == company_id,
                    TemplateTask.name == starter.name,
                )
                .first()
            )
            if not template:
                template = TemplateTask(
                    company_id=company_id,
                    name=starter.name,
                    description=starter.description,
                    default_price=None,
                    unit="servicio",
                    is_active=True,
                )
                db.add(template)
                db.flush()

            db.add(
                LocationTemplate(
                    location_id=location.id,
                    template_task_id=template.id,
                )
            )

        db.add(company)
        db.commit()
    except Exception:
        db.rollback()
        raise

    return CompanyOnboardingResponse(
        onboarding_completed=True,
        operating_model=data.operating_model,
        created=location is not None,
        location_id=location.id if location else None,
        location_name=location.name if location else None,
        template_task_id=template.id if template else None,
        template_name=template.name if template else None,
    )
