from app.core.security import create_access_token
from app.models.company import Company
from app.models.location import Location
from app.models.location_company_access import LocationCompanyAccess
from app.models.location_zone import LocationZone
from app.models.task_item import TaskItem
from app.models.user import User


def _company(db, name: str) -> Company:
    company = Company(
        name=name,
        tax_id=f"{name.upper()}-ZONES",
        address="Calle Zonas 1",
        phone="600000000",
        email=f"{name.lower()}@zones.test",
        subscription_plan="pro",
        subscription_status="active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def _user(db, company: Company, email: str, role_id: int = 1) -> User:
    user = User(
        email=email,
        hashed_password="unused",
        full_name=email.split("@", 1)[0],
        company_id=company.id,
        role_id=role_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _headers(user: User) -> dict[str, str]:
    token = create_access_token({"sub": user.email, "ver": user.session_version})
    return {"Authorization": f"Bearer {token}"}


def _location(db, company: Company, name: str) -> Location:
    location = Location(
        name=name,
        address="Calle Zonas 2",
        city="Madrid",
        owner_company_id=company.id,
        managing_company_id=company.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


def _create_zone(client, user: User, location_id: int, name: str, zone_type: str = "other"):
    return client.post(
        f"/api/v1/locations/{location_id}/zones",
        headers=_headers(user),
        json={"name": name, "zone_type": zone_type},
    )


def test_owner_manages_optional_zones_and_archiving_keeps_history(client, db):
    company = _company(db, "OwnerZones")
    admin = _user(db, company, "admin@owner-zones.test")
    location = _location(db, company, "Oficina Zonas")

    created = _create_zone(client, admin, location.id, "Baño 1", "bathroom")

    assert created.status_code == 201, created.text
    zone = created.json()
    assert zone["name"] == "Baño 1"
    assert zone["zone_type"] == "bathroom"
    assert zone["is_active"] is True

    listed = client.get(
        f"/api/v1/locations/{location.id}/zones",
        headers=_headers(admin),
    )
    assert listed.status_code == 200, listed.text
    assert [item["id"] for item in listed.json()] == [zone["id"]]

    archived = client.delete(
        f"/api/v1/locations/{location.id}/zones/{zone['id']}",
        headers=_headers(admin),
    )
    assert archived.status_code == 204, archived.text
    assert db.get(LocationZone, zone["id"]).is_active is False


def test_shared_company_can_use_zones_but_cannot_reconfigure_them(client, db):
    owner = _company(db, "ZoneOwner")
    receiver = _company(db, "ZoneReceiver")
    owner_admin = _user(db, owner, "admin@zone-owner.test")
    receiver_admin = _user(db, receiver, "admin@zone-receiver.test")
    location = _location(db, owner, "Local Compartido")
    db.add(
        LocationCompanyAccess(
            location_id=location.id,
            company_id=receiver.id,
            relationship_type="service_provider",
            can_manage_tasks=True,
        )
    )
    db.commit()

    assert _create_zone(client, owner_admin, location.id, "Cocina", "kitchen").status_code == 201
    forbidden = _create_zone(client, receiver_admin, location.id, "Recepción", "reception")

    assert forbidden.status_code == 403
    visible = client.get(
        f"/api/v1/locations/{location.id}/zones",
        headers=_headers(receiver_admin),
    )
    assert visible.status_code == 200
    assert [item["name"] for item in visible.json()] == ["Cocina"]


def test_task_persists_selected_location_zones_and_rejects_another_location(client, db):
    company = _company(db, "TaskZones")
    admin = _user(db, company, "admin@task-zones.test")
    office = _location(db, company, "Oficina")
    warehouse = _location(db, company, "Almacén")
    bathroom = _create_zone(client, admin, office.id, "Baño 1", "bathroom").json()
    kitchen = _create_zone(client, admin, office.id, "Cocina", "kitchen").json()
    foreign_zone = _create_zone(client, admin, warehouse.id, "Muelle", "other").json()

    created = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Limpieza parcial",
            "unit": "servicio",
            "location_id": office.id,
            "zone_ids": [bathroom["id"], kitchen["id"]],
        },
    )

    assert created.status_code == 201, created.text
    payload = created.json()
    assert [(zone["id"], zone["name"], zone["zone_type"]) for zone in payload["zones"]] == [
        (bathroom["id"], "Baño 1", "bathroom"),
        (kitchen["id"], "Cocina", "kitchen"),
    ]

    listed = client.get("/api/v1/task-items/", headers=_headers(admin))
    assert listed.status_code == 200, listed.text
    assert [zone["name"] for zone in listed.json()[0]["zones"]] == ["Baño 1", "Cocina"]

    updated = client.patch(
        f"/api/v1/task-items/{payload['id']}",
        headers=_headers(admin),
        json={"zone_ids": [kitchen["id"]]},
    )
    assert updated.status_code == 200, updated.text
    assert [zone["name"] for zone in updated.json()["zones"]] == ["Cocina"]

    rejected = client.post(
        "/api/v1/task-items/",
        headers=_headers(admin),
        json={
            "title": "Zona incorrecta",
            "unit": "servicio",
            "location_id": office.id,
            "zone_ids": [foreign_zone["id"]],
        },
    )
    assert rejected.status_code == 400
    assert db.query(TaskItem).filter(TaskItem.title == "Zona incorrecta").count() == 0
