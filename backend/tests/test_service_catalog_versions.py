import pytest
from fastapi import HTTPException

from app.models.company import Company
from app.schemas.task_item import TaskItemCreate, TaskItemUpdate
from app.schemas.template_task import TemplateTaskCreate, TemplateTaskUpdate
from app.services import task_item_service, template_task_service
from tests.test_reservations import _location, _user


def _company(db, *, name: str, tax_id: str) -> Company:
    company = Company(
        name=name,
        tax_id=tax_id,
        address="Calle del Catálogo 1",
        phone="600000000",
        email=f"{tax_id.lower()}@example.test",
        subscription_plan="top",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def test_service_catalog_keeps_immutable_versions_when_a_service_changes(db):
    company = _company(db, name="Catálogo Uno", tax_id="CATALOG-ONE")
    service = template_task_service.create_template_task(
        db,
        TemplateTaskCreate(
            name="Limpieza de salida",
            description="- [ ] Revisar baños\n- [ ] Aspirar salón",
            default_price=90.0,
            unit="servicio",
            pricing_mode="fixed",
            estimated_duration_minutes=75,
            requirements="Llaves y material de limpieza",
        ),
        company.id,
    )

    first_history = template_task_service.get_service_catalog_versions(
        db, service.id, company.id
    )
    assert service.catalog_version == 1
    assert [(item.version, item.default_price, item.estimated_duration_minutes) for item in first_history] == [
        (1, 90.0, 75)
    ]

    updated = template_task_service.update_template_task(
        db,
        service.id,
        TemplateTaskUpdate(
            default_price=110.0,
            estimated_duration_minutes=95,
            requirements="Llaves, aspiradora y material de limpieza",
        ),
        company.id,
    )
    history = template_task_service.get_service_catalog_versions(db, service.id, company.id)

    assert updated.catalog_version == 2
    assert [(item.version, item.default_price, item.estimated_duration_minutes) for item in history] == [
        (2, 110.0, 95),
        (1, 90.0, 75),
    ]
    assert history[1].requirements == "Llaves y material de limpieza"

    unchanged = template_task_service.update_template_task(
        db,
        service.id,
        TemplateTaskUpdate(
            default_price=110.0,
            estimated_duration_minutes=95,
            requirements="Llaves, aspiradora y material de limpieza",
        ),
        company.id,
    )

    assert unchanged.catalog_version == 2
    assert [item.version for item in template_task_service.get_service_catalog_versions(db, service.id, company.id)] == [2, 1]


def test_service_catalog_versions_fail_closed_across_companies(db):
    owner = _company(db, name="Prestadora", tax_id="CATALOG-OWNER")
    outsider = _company(db, name="Ajena", tax_id="CATALOG-OUTSIDER")
    service = template_task_service.create_template_task(
        db,
        TemplateTaskCreate(
            name="Limpieza semanal",
            unit="hora",
            pricing_mode="hourly",
        ),
        owner.id,
    )

    with pytest.raises(HTTPException) as history_error:
        template_task_service.get_service_catalog_versions(db, service.id, outsider.id)
    with pytest.raises(HTTPException) as update_error:
        template_task_service.update_template_task(
            db,
            service.id,
            TemplateTaskUpdate(default_price=42.0),
            outsider.id,
        )

    assert history_error.value.status_code == 404
    assert update_error.value.status_code == 404


def test_catalog_work_keeps_its_selected_version_and_rejects_foreign_services(db):
    owner = _company(db, name="Prestadora de catálogo", tax_id="CATALOG-WORK-OWNER")
    outsider = _company(db, name="Ajena de catálogo", tax_id="CATALOG-WORK-OUTSIDER")
    admin = _user(db, owner, role_id=1, email="catalog-work-owner@example.test")
    location = _location(db, owner)
    service = template_task_service.create_template_task(
        db,
        TemplateTaskCreate(
            name="Limpieza de terraza",
            description="- [ ] Barrer terraza",
            default_price=55.0,
            unit="servicio",
        ),
        owner.id,
    )
    foreign_service = template_task_service.create_template_task(
        db,
        TemplateTaskCreate(name="Servicio ajeno", unit="servicio"),
        outsider.id,
    )

    task = task_item_service.create_task_item(
        db,
        admin,
        TaskItemCreate(
            title="Limpieza de terraza",
            description=service.description,
            price=service.default_price,
            quantity=1,
            unit=service.unit,
            template_task_id=service.id,
            location_id=location.id,
        ),
    )
    first_version = task.service_catalog_version_id
    assert first_version is not None

    template_task_service.update_template_task(
        db,
        service.id,
        TemplateTaskUpdate(default_price=65.0),
        owner.id,
    )
    db.refresh(task)
    assert task.service_catalog_version_id == first_version

    task_item_service.update_task_item(
        db,
        admin,
        task.id,
        TaskItemUpdate(template_task_id=service.id),
    )
    db.refresh(task)
    assert task.service_catalog_version_id != first_version

    with pytest.raises(HTTPException) as create_error:
        task_item_service.create_task_item(
            db,
            admin,
            TaskItemCreate(
                title="Servicio extranjero",
                unit="servicio",
                template_task_id=foreign_service.id,
                location_id=location.id,
            ),
        )
    with pytest.raises(HTTPException) as update_error:
        task_item_service.update_task_item(
            db,
            admin,
            task.id,
            TaskItemUpdate(template_task_id=foreign_service.id),
        )

    assert create_error.value.status_code == 404
    assert update_error.value.status_code == 404
