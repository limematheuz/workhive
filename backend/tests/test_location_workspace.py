from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.user import User


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-WORKSPACE",
        address="Calle Espacios 1",
        phone="600000000",
        email=f"{name.lower()}@workspace.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _admin(db, company: Company) -> User:
    user = User(
        email=f"admin@{company.name.lower()}.test",
        hashed_password="unused",
        full_name="Admin Workspace",
        company_id=company.id,
        role_id=1,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def test_location_setup_persists_profile_spaces_and_suggested_task_templates(client, db):
    company = _company(db, "WorkspaceOwner")
    admin = _admin(db, company)

    response = client.post(
        "/api/v1/locations/",
        headers=_headers(admin),
        json={
            "name": "Oficina central",
            "address": "Avenida Principal 10",
            "city": "Madrid",
            "profile": {
                "site_type": "office",
                "internal_code": "OFI-001",
                "attributes": {
                    "office_count": 2,
                    "bathroom_count": 1,
                    "has_kitchen": True,
                },
            },
            "access": {
                "permitted_days": ["mon", "tue", "wed", "thu", "fri"],
                "permitted_from": "06:00",
                "permitted_until": "22:00",
                "access_method": "code",
                "access_code": "1234",
                "instructions": "Llamar al timbre de recepción.",
            },
            "spaces": [
                {
                    "name": "Despacho 1",
                    "space_type": "office",
                    "tasks": [
                        {
                            "title": "Limpiar superficies",
                            "category": "cleaning",
                            "estimated_minutes": 5,
                        }
                    ],
                },
                {"name": "Baño 1", "space_type": "bathroom"},
            ],
        },
    )

    assert response.status_code == 201, response.text
    location = response.json()
    assert location["profile"]["site_type"] == "office"
    assert location["profile"]["internal_code"] == "OFI-001"
    assert location["access"]["has_access_code"] is True
    assert "access_code" not in location["access"]
    assert location["access"]["permitted_days"] == ["mon", "tue", "wed", "thu", "fri"]

    spaces = client.get(
        f"/api/v1/locations/{location['id']}/spaces",
        headers=_headers(admin),
    )
    assert spaces.status_code == 200, spaces.text
    assert [(space["name"], space["space_type"]) for space in spaces.json()] == [
        ("Despacho 1", "office"),
        ("Baño 1", "bathroom"),
    ]
    assert spaces.json()[0]["tasks"][0]["title"] == "Limpiar superficies"

    child_space = client.post(
        f"/api/v1/locations/{location['id']}/spaces",
        headers=_headers(admin),
        json={
            "name": "Armario de limpieza",
            "space_type": "storage",
            "parent_id": spaces.json()[0]["id"],
        },
    )
    assert child_space.status_code == 201, child_space.text
    assert child_space.json()["parent_id"] == spaces.json()[0]["id"]

    archived = client.delete(
        f"/api/v1/locations/{location['id']}/spaces/{spaces.json()[0]['id']}/tasks/{spaces.json()[0]['tasks'][0]['id']}",
        headers=_headers(admin),
    )
    assert archived.status_code == 204, archived.text
    refreshed_spaces = client.get(
        f"/api/v1/locations/{location['id']}/spaces",
        headers=_headers(admin),
    )
    assert refreshed_spaces.status_code == 200, refreshed_spaces.text
    assert refreshed_spaces.json()[0]["tasks"] == []


def test_location_spaces_can_be_reordered_atomically(client, db):
    company = _company(db, "ReorderWorkspace")
    admin = _admin(db, company)
    headers = _headers(admin)
    location = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Centro ordenado",
            "address": "Calle Orden 1",
            "city": "Madrid",
            "spaces": [
                {"name": "Recepción", "space_type": "common_area"},
                {"name": "Baño", "space_type": "bathroom"},
                {"name": "Almacén", "space_type": "storage"},
            ],
        },
    ).json()
    spaces = client.get(f"/api/v1/locations/{location['id']}/spaces", headers=headers).json()
    ordered_ids = [spaces[2]["id"], spaces[0]["id"], spaces[1]["id"]]

    response = client.put(
        f"/api/v1/locations/{location['id']}/spaces/order",
        headers=headers,
        json={"space_ids": ordered_ids},
    )

    assert response.status_code == 204, response.text
    reordered = client.get(f"/api/v1/locations/{location['id']}/spaces", headers=headers)
    assert [space["id"] for space in reordered.json()] == ordered_ids

    invalid = client.put(
        f"/api/v1/locations/{location['id']}/spaces/order",
        headers=headers,
        json={"space_ids": ordered_ids[:2]},
    )
    assert invalid.status_code == 422
    assert [space["id"] for space in client.get(f"/api/v1/locations/{location['id']}/spaces", headers=headers).json()] == ordered_ids


def test_location_workspace_fields_are_updated_and_returned(client, db):
    company = _company(db, "UpdateWorkspace")
    admin = _admin(db, company)
    headers = _headers(admin)
    created = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Local inicial",
            "address": "Calle Inicial 1",
            "city": "Madrid",
        },
    )
    assert created.status_code == 201, created.text

    updated = client.patch(
        f"/api/v1/locations/{created.json()['id']}",
        headers=headers,
        json={
            "name": "Local actualizado",
            "address": "Avenida Actualizada 20",
            "city": "Barcelona",
            "postal_code": "08001",
            "profile": {
                "site_type": "office",
                "internal_code": "OFI-UPDATE",
                "contact_name": "María Pérez",
                "contact_phone": "600 111 222",
                "service_notes": "Acceso por recepción.",
                "attributes": {"office_count": 3, "has_kitchen": True},
            },
            "access": {
                "permitted_days": ["mon", "tue", "wed", "thu", "fri"],
                "permitted_from": "07:00",
                "permitted_until": "21:00",
                "requires_outside_hours_authorization": True,
                "access_method": "code",
                "keys_available": True,
                "keys_location": "Recepción",
                "key_custodian": "Conserjería",
                "instructions": "Llamar antes de entrar.",
                "access_code": "4321",
            },
        },
    )

    assert updated.status_code == 200, updated.text
    location = updated.json()
    assert location["name"] == "Local actualizado"
    assert location["profile"]["internal_code"] == "OFI-UPDATE"
    assert location["profile"]["attributes"]["office_count"] == 3
    assert location["access"]["requires_outside_hours_authorization"] is True
    assert location["access"]["keys_location"] == "Recepción"
    assert location["access"]["has_access_code"] is True
    assert "access_code" not in location["access"]


def test_location_operational_contacts_are_scoped_to_the_location(client, db):
    company = _company(db, "LocationContacts")
    admin = _admin(db, company)
    headers = _headers(admin)
    created = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Oficina con recepción",
            "address": "Calle Contactos 1",
            "city": "Madrid",
            "contacts": [
                {
                    "full_name": "Ana Recepción",
                    "phone": "600 111 222",
                    "role": "access",
                    "is_primary": True,
                },
                {
                    "full_name": "Luis Guardia",
                    "email": "luis@example.com",
                    "role": "emergency",
                },
            ],
        },
    )

    assert created.status_code == 201, created.text
    location = created.json()
    assert [(contact["full_name"], contact["role"]) for contact in location["contacts"]] == [
        ("Ana Recepción", "access"),
        ("Luis Guardia", "emergency"),
    ]
    primary_contact = location["contacts"][0]

    updated = client.patch(
        f"/api/v1/locations/{location['id']}",
        headers=headers,
        json={
            "contacts": [
                {
                    "id": primary_contact["id"],
                    "full_name": "Ana Recepción",
                    "phone": "600 333 444",
                    "role": "operations",
                    "is_primary": True,
                }
            ],
        },
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["contacts"] == [
        {
            "id": primary_contact["id"],
            "location_id": location["id"],
            "full_name": "Ana Recepción",
            "email": None,
            "phone": "600 333 444",
            "role": "operations",
            "is_primary": True,
            "is_active": True,
        }
    ]

    second_company = _company(db, "OutsideLocationContacts")
    outside_admin = _admin(db, second_company)
    denied = client.patch(
        f"/api/v1/locations/{location['id']}",
        headers=_headers(outside_admin),
        json={
            "contacts": [
                {
                    "id": primary_contact["id"],
                    "full_name": "Intento externo",
                    "phone": "699 999 999",
                    "role": "general",
                    "is_primary": True,
                }
            ],
        },
    )
    assert denied.status_code in {403, 404}
    assert client.get(
        f"/api/v1/locations/{location['id']}", headers=headers
    ).json()["contacts"][0]["full_name"] == "Ana Recepción"


def test_location_contacts_require_a_single_primary_contact_and_a_contact_method(client, db):
    company = _company(db, "LocationContactValidation")
    admin = _admin(db, company)
    headers = _headers(admin)

    missing_contact_method = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Local sin medio",
            "address": "Calle Validación 1",
            "city": "Madrid",
            "contacts": [{"full_name": "Sin medio", "role": "general"}],
        },
    )
    assert missing_contact_method.status_code == 422

    duplicate_primary = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Local con dos principales",
            "address": "Calle Validación 2",
            "city": "Madrid",
            "contacts": [
                {
                    "full_name": "Primera",
                    "phone": "600 000 001",
                    "role": "operations",
                    "is_primary": True,
                },
                {
                    "full_name": "Segunda",
                    "phone": "600 000 002",
                    "role": "access",
                    "is_primary": True,
                },
            ],
        },
    )
    assert duplicate_primary.status_code == 422


def test_location_operational_risks_are_scoped_to_the_location(client, db):
    company = _company(db, "LocationRisks")
    admin = _admin(db, company)
    headers = _headers(admin)
    created = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Oficina con riesgos",
            "address": "Calle Riesgos 1",
            "city": "Madrid",
            "risks": [
                {
                    "title": "Suelo resbaladizo",
                    "description": "La entrada queda mojada después de la lluvia.",
                    "severity": "high",
                    "mitigation_notes": "Señalizar y usar calzado antideslizante.",
                },
                {"title": "Escalera estrecha", "severity": "medium"},
            ],
        },
    )

    assert created.status_code == 201, created.text
    location = created.json()
    assert [(risk["title"], risk["severity"], risk["status"]) for risk in location["risks"]] == [
        ("Suelo resbaladizo", "high", "open"),
        ("Escalera estrecha", "medium", "open"),
    ]
    first_risk = location["risks"][0]

    updated = client.patch(
        f"/api/v1/locations/{location['id']}",
        headers=headers,
        json={
            "risks": [
                {
                    "id": first_risk["id"],
                    "title": "Suelo resbaladizo",
                    "description": "La entrada queda mojada después de la lluvia.",
                    "severity": "high",
                    "status": "mitigated",
                    "mitigation_notes": "Alfombrilla instalada y señalización disponible.",
                }
            ]
        },
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["risks"] == [
        {
            "id": first_risk["id"],
            "location_id": location["id"],
            "title": "Suelo resbaladizo",
            "description": "La entrada queda mojada después de la lluvia.",
            "severity": "high",
            "status": "mitigated",
            "mitigation_notes": "Alfombrilla instalada y señalización disponible.",
        }
    ]

    other = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Otro local",
            "address": "Calle Riesgos 2",
            "city": "Madrid",
            "risks": [{"title": "Escalón", "severity": "low"}],
        },
    ).json()
    denied = client.patch(
        f"/api/v1/locations/{location['id']}",
        headers=headers,
        json={
            "risks": [
                {
                    "id": other["risks"][0]["id"],
                    "title": "Intento cruzado",
                    "severity": "critical",
                }
            ]
        },
    )
    assert denied.status_code == 404
    assert client.get(f"/api/v1/locations/{location['id']}", headers=headers).json()["risks"][0]["status"] == "mitigated"


def test_location_service_windows_are_separate_from_access_and_scoped(client, db):
    company = _company(db, "LocationServiceWindows")
    admin = _admin(db, company)
    headers = _headers(admin)
    created = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Clínica con horario de servicio",
            "address": "Calle Horarios 1",
            "city": "Madrid",
            "access": {"permitted_days": ["mon"], "permitted_from": "06:00", "permitted_until": "22:00"},
            "service_windows": [
                {
                    "label": "Antes de abrir",
                    "days": ["mon", "wed", "fri"],
                    "starts_at": "07:00",
                    "ends_at": "08:30",
                    "notes": "No interrumpir recepción.",
                }
            ],
        },
    )

    assert created.status_code == 201, created.text
    location = created.json()
    assert location["access"]["permitted_until"] == "22:00"
    assert location["service_windows"] == [
        {
            "id": location["service_windows"][0]["id"],
            "location_id": location["id"],
            "label": "Antes de abrir",
            "days": ["mon", "wed", "fri"],
            "starts_at": "07:00",
            "ends_at": "08:30",
            "notes": "No interrumpir recepción.",
            "is_active": True,
        }
    ]

    service_window_id = location["service_windows"][0]["id"]
    updated = client.patch(
        f"/api/v1/locations/{location['id']}",
        headers=headers,
        json={
            "service_windows": [
                {
                    "id": service_window_id,
                    "label": "Antes de abrir",
                    "days": ["mon", "tue", "wed", "thu", "fri"],
                    "starts_at": "06:30",
                    "ends_at": "08:30",
                    "is_active": False,
                }
            ]
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["service_windows"][0]["is_active"] is False
    assert updated.json()["access"]["permitted_until"] == "22:00"

    other = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Otro horario",
            "address": "Calle Horarios 2",
            "city": "Madrid",
            "service_windows": [{"days": ["sat"], "starts_at": "10:00", "ends_at": "12:00"}],
        },
    ).json()
    denied = client.patch(
        f"/api/v1/locations/{location['id']}",
        headers=headers,
        json={
            "service_windows": [
                {
                    "id": other["service_windows"][0]["id"],
                    "days": ["sat"],
                    "starts_at": "10:00",
                    "ends_at": "12:00",
                }
            ]
        },
    )
    assert denied.status_code == 404
    assert client.get(f"/api/v1/locations/{location['id']}", headers=headers).json()["service_windows"][0]["starts_at"] == "06:30"


def test_location_service_windows_require_days_and_a_valid_same_day_range(client, db):
    company = _company(db, "LocationServiceWindowValidation")
    admin = _admin(db, company)

    invalid = client.post(
        "/api/v1/locations/",
        headers=_headers(admin),
        json={
            "name": "Horario inválido",
            "address": "Calle Validación 3",
            "city": "Madrid",
            "service_windows": [{"days": [], "starts_at": "18:00", "ends_at": "08:00"}],
        },
    )
    assert invalid.status_code == 422


def test_space_catalog_generates_editable_office_suggestions(client, db):
    company = _company(db, "CatalogOwner")
    admin = _admin(db, company)

    catalog = client.get("/api/v1/locations/catalog", headers=_headers(admin))
    assert catalog.status_code == 200, catalog.text
    assert any(item["id"] == "office" for item in catalog.json()["site_types"])

    response = client.post(
        "/api/v1/locations/space-suggestions",
        headers=_headers(admin),
        json={
            "site_type": "office",
            "attributes": {
                "office_count": 2,
                "bathroom_count": 1,
                "has_kitchen": True,
            },
        },
    )

    assert response.status_code == 200, response.text
    assert [space["name"] for space in response.json()["spaces"]] == [
        "Despacho 1",
        "Despacho 2",
        "Baño 1",
        "Cocina",
    ]
    assert response.json()["spaces"][2]["tasks"]


def test_bulk_import_previews_errors_and_commits_only_valid_rows(client, db):
    company = _company(db, "BulkOwner")
    admin = _admin(db, company)
    headers = _headers(admin)
    invalid_csv = (
        "name,address,city,site_type,internal_code,spaces\n"
        "Oficina Norte,Calle Norte 1,Madrid,office,OFI-N,Despacho 1|Baño 1\n"
        ",Calle Sin Nombre,Sevilla,hotel,HOT-S,Recepción\n"
    )

    preview = client.post(
        "/api/v1/locations/import/preview",
        headers=headers,
        json={"csv_content": invalid_csv},
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["valid"] is False
    assert preview.json()["rows"][1]["errors"] == ["name is required"]

    rejected = client.post(
        "/api/v1/locations/import",
        headers=headers,
        json={"csv_content": invalid_csv},
    )
    assert rejected.status_code == 422
    assert db.query(Location).filter(Location.owner_company_id == company.id).count() == 0

    malformed_csv = (
        "name,address,city,site_type,spaces\n"
        f"Oficina Larga,Calle Norte 1,Madrid,office,{'X' * 101}\n"
    )
    malformed_preview = client.post(
        "/api/v1/locations/import/preview",
        headers=headers,
        json={"csv_content": malformed_csv},
    )
    assert malformed_preview.status_code == 200, malformed_preview.text
    assert malformed_preview.json()["valid"] is False
    assert malformed_preview.json()["rows"][0]["errors"]

    valid_csv = (
        "name,address,city,site_type,internal_code,spaces\n"
        "Oficina Norte,Calle Norte 1,Madrid,office,OFI-N,Despacho 1|Baño 1\n"
        "Hotel Sur,Calle Sur 2,Sevilla,hotel,HOT-S,Recepción|Habitación 1\n"
    )
    imported = client.post(
        "/api/v1/locations/import",
        headers=headers,
        json={"csv_content": valid_csv},
    )
    assert imported.status_code == 201, imported.text
    assert imported.json()["created_count"] == 2
    assert db.query(Location).filter(Location.owner_company_id == company.id).count() == 2


def test_task_uses_spaces_and_selected_space_tasks_as_its_checklist(client, db):
    company = _company(db, "TaskWorkspace")
    admin = _admin(db, company)
    headers = _headers(admin)
    location = client.post(
        "/api/v1/locations/",
        headers=headers,
        json={
            "name": "Clínica Centro",
            "address": "Calle Salud 1",
            "city": "Valencia",
            "spaces": [
                {
                    "name": "Baño pacientes",
                    "space_type": "bathroom",
                    "tasks": [
                        {
                            "title": "Desinfectar lavabo",
                            "category": "disinfection",
                            "estimated_minutes": 4,
                        }
                    ],
                }
            ],
        },
    ).json()
    space = client.get(
        f"/api/v1/locations/{location['id']}/spaces",
        headers=headers,
    ).json()[0]

    created = client.post(
        "/api/v1/task-items/",
        headers=headers,
        json={
            "title": "Limpieza de mañana",
            "unit": "servicio",
            "location_id": location["id"],
            "space_ids": [space["id"]],
            "space_task_template_ids": [space["tasks"][0]["id"]],
        },
    )

    assert created.status_code == 201, created.text
    assert created.json()["spaces"][0]["name"] == "Baño pacientes"
    assert created.json()["spaces"][0]["space_id"] == space["id"]
    assert created.json()["checklist_items"][0]["space_name"] == "Baño pacientes"
    assert created.json()["checklist_items"][0]["text"] == "Desinfectar lavabo"
