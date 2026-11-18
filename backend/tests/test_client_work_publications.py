from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import uuid4
import json
import pytest
from PIL import Image
from app.core.config import settings
from app.models.audit_log import AuditLog
from app.models.client_portal_grant import ClientPortalGrant
from app.models.company_membership import CompanyMembership
from app.models.task_item import TaskItem
from app.models.task_report import TaskReport
from app.models.task_structure import TaskChecklistItem
from app.models.task_client_publication import TaskClientPublication, TaskClientPublicationPhoto, TaskClientAcceptance
from app.models.work_session import WorkSession
from app.services.storage_service import build_media_key, get_object_storage
from tests.test_client_permission_authorization import _company, _bootstrap_admin, _headers, _user, _assign_company_profile
from test_client_portal_api import _portal_user, _grant
from test_service_contracts import _client, _location


def setup(client, db, suffix="published-work"):
    company = _company(db, suffix); company.subscription_plan = "top"
    owner = _bootstrap_admin(db, company, suffix); headers = _headers(owner)
    customer = _client(client, headers)
    site = _location(client, headers, customer["id"])
    now = datetime.now(timezone.utc)
    task = TaskItem(company_id=company.id, location_id=site["id"], title="Limpieza ejecutada", unit="service", status="completed",
        scheduled_start_at=now-timedelta(hours=2), date_done=now-timedelta(hours=1),
        description="PRIVATE_TASK_DESCRIPTION", notes="PRIVATE_TASK_NOTES", operational_notes=[{"text": "PRIVATE_OPERATIONAL_NOTE"}])
    db.add(task); db.flush()
    checks = [TaskChecklistItem(task=task, position=index, text=text, completed=True) for index, text in enumerate(("Suelo realizado", "PRIVATE_CHECKLIST"))]
    db.add_all(checks)
    reports = [TaskReport(task_item_id=task.id, reporter_user_id=owner.id, reporter_company_id=company.id, reporter_name=owner.full_name,
        client_event_id=str(uuid4()), report_type="note", description=text) for text in ("Observación compartible", "PRIVATE_INTERNAL_REPORT")]
    stream = BytesIO(); Image.new("RGB", (3, 3), "blue").save(stream, format="PNG"); photo_bytes = stream.getvalue()
    key = build_media_key(company.id, "task-report", "png"); get_object_storage().put(key, photo_bytes, "image/png")
    photo = TaskReport(task_item_id=task.id, reporter_user_id=owner.id, reporter_company_id=company.id, reporter_name=owner.full_name,
        client_event_id=str(uuid4()), report_type="photo", media_key=key, file_name="PRIVATE_ORIGINAL_NAME.png")
    db.add_all([*reports, photo]); db.flush()
    portal, portal_headers = _portal_user(db, email=f"{suffix}@client-demo.example.com", suffix=suffix)
    from app.models.client import Client
    grant = _grant(db, company=company, customer=db.get(Client, customer["id"]), user=portal, admin=owner)
    db.commit()
    return dict(company=company, owner=owner, headers=headers, task=task, checks=checks, reports=reports, photo=photo,
        photo_bytes=photo_bytes, source_key=key, portal=portal, portal_headers=portal_headers, grant=grant, site=site)


def manager_url(data):
    return f"/api/v1/task-client-publications/tasks/{data['task'].id}"


def portal_url(data):
    return f"/api/v1/client-portal/workspaces/{data['grant'].id}/services"


def publish(client, data, *, summary="Servicio realizado conforme al alcance", checks=None, reports=None):
    candidate = client.get(manager_url(data), headers=data["headers"])
    assert candidate.status_code == 200, candidate.text
    state = candidate.json()
    result = client.post(manager_url(data), headers=data["headers"], json={"public_summary": summary,
        "checklist_item_ids": checks if checks is not None else [data["checks"][0].id],
        "report_ids": reports if reports is not None else [data["reports"][0].id, data["photo"].id],
        "expected_revision": state["latest_revision"], "expected_source_hash": state["source_hash"], "confirmed_publication": True})
    assert result.status_code == 201, result.text
    return result.json()["latest"]


def consent(part):
    return {"expected_revision": part["revision"], "expected_manifest_hash": part["manifest_hash"], "signer_name": "Marina Cliente", "confirmed": True}


def test_reports_are_private_until_explicit_selection_and_publication(client, db):
    data = setup(client, db)
    assert client.get(portal_url(data), headers=data["portal_headers"]).json()["items"] == []
    candidate = client.get(manager_url(data), headers=data["headers"])
    assert candidate.status_code == 200 and candidate.json()["is_public"] is False
    assert candidate.json()["latest"] is None and candidate.json()["task"]["client_name"]
    part = publish(client, data)
    response = client.get(portal_url(data), headers=data["portal_headers"])
    assert response.status_code == 200, response.text
    assert len(response.json()["items"]) == 1 and response.json()["items"][0]["id"] == part["id"]
    assert "PRIVATE_" not in response.text and "media_key" not in response.text and data["source_key"] not in response.text
    assert response.json()["items"][0]["manifest"]["reports"][0]["text"] == "Observación compartible"
    assert len(part["manifest"]["checklist"]) == 1 and len(part["manifest"]["photos"]) == 1
    photo_id = part["manifest"]["photos"][0]["id"]
    media = client.get(portal_url(data) + f"/{part['id']}/photos/{photo_id}", headers=data["portal_headers"])
    assert media.status_code == 200 and media.content == data["photo_bytes"]
    assert media.headers["cache-control"] == "private, no-store"
    copy = db.query(TaskClientPublicationPhoto).filter_by(id=photo_id).one()
    assert copy.media_key != data["source_key"]
    assert client.get("/api/v1/uploads/media/" + copy.media_key, headers=data["headers"]).status_code == 404
    assert client.get(manager_url(data) + f"/photos/{photo_id}", headers=data["headers"]).content == data["photo_bytes"]
    assert client.get(manager_url(data) + "/pdf", headers=data["headers"]).content.startswith(b"%PDF")
    pdf = client.get(portal_url(data) + f"/{part['id']}/pdf", headers=data["portal_headers"])
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_publication_requires_manager_scope_and_cannot_select_foreign_sources(client, db):
    data = setup(client, db, "share-owner")
    other = setup(client, db, "share-other")
    assert client.get(manager_url(data), headers=other["headers"]).status_code == 404
    reader = _user(db, data["company"], "share-readonly", role_id=3)
    _assign_company_profile(db, company=data["company"], admin=data["owner"], user=reader, name="Lectura operativa", permission_codes={"work.read"})
    assert client.get(manager_url(data), headers=_headers(reader)).status_code == 403
    state = client.get(manager_url(data), headers=data["headers"]).json()
    body = {"public_summary": "Selección", "checklist_item_ids": [other["checks"][0].id], "report_ids": [other["photo"].id], "expected_revision": 0, "expected_source_hash": state["source_hash"], "confirmed_publication": True}
    denied = client.post(manager_url(data), headers=data["headers"], json=body)
    assert denied.status_code == 422 and db.query(TaskClientPublication).count() == 0
    assert client.post(manager_url(data), headers=data["portal_headers"], json=body).status_code in {400, 403}


def test_customer_scope_and_current_location_binding_are_enforced(client, db):
    data = setup(client, db, "client-scope")
    other = setup(client, db, "client-foreign")
    part = publish(client, data)
    photo_id = part["manifest"]["photos"][0]["id"]
    assert client.get(portal_url(other) + f"/{part['id']}", headers=other["portal_headers"]).status_code == 404
    assert client.get(portal_url(other) + f"/{part['id']}/photos/{photo_id}", headers=other["portal_headers"]).status_code == 404
    assert client.post(portal_url(other) + f"/{part['id']}/acceptance", headers=other["portal_headers"], json=consent(part)).status_code == 404
    assert client.get(portal_url(other), headers=data["portal_headers"]).status_code == 403
    from app.models.location import Location
    location = db.get(Location, data["site"]["id"])
    replacement_customer = _client(client, data["headers"])
    location.client_id = replacement_customer["id"]; db.commit()
    assert client.get(portal_url(data), headers=data["portal_headers"]).json()["items"] == []
    assert client.get(portal_url(data) + f"/{part['id']}/photos/{photo_id}", headers=data["portal_headers"]).status_code == 404


def test_source_edits_and_deletion_never_modify_published_manifest_or_photo(client, db):
    data = setup(client, db, "immutable-copy")
    part = publish(client, data)
    original_hash = part["manifest_hash"]
    photo_id = part["manifest"]["photos"][0]["id"]
    data["reports"][0].description = "PRIVATE_MODIFIED_LATER"
    db.delete(data["photo"]); db.commit(); get_object_storage().delete(data["source_key"])
    read = client.get(portal_url(data) + f"/{part['id']}", headers=data["portal_headers"])
    assert read.status_code == 200 and read.json()["manifest_hash"] == original_hash
    assert "PRIVATE_MODIFIED_LATER" not in read.text
    image = client.get(portal_url(data) + f"/{part['id']}/photos/{photo_id}", headers=data["portal_headers"])
    assert image.status_code == 200 and image.content == data["photo_bytes"]


def test_revisions_and_client_validation_remain_bound_to_the_published_content(client, db):
    data = setup(client, db, "client-validation")
    first = publish(client, data)
    second = publish(client, data, summary="Segunda revisión confirmada")
    stale = client.post(portal_url(data) + f"/{first['id']}/acceptance", headers=data["portal_headers"], json=consent(first))
    assert stale.status_code == 409
    wrong = {**consent(second), "expected_manifest_hash": "0"*64}
    assert client.post(portal_url(data) + f"/{second['id']}/acceptance", headers=data["portal_headers"], json=wrong).status_code == 409
    assert client.post(portal_url(data) + f"/{second['id']}/acceptance", headers=data["portal_headers"], json={**consent(second), "confirmed": False}).status_code == 422
    accepted = client.post(portal_url(data) + f"/{second['id']}/acceptance", headers=data["portal_headers"], json=consent(second))
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["acceptance"]["signer_name"] == "Marina Cliente"
    assert db.query(TaskClientAcceptance).count() == 1
    record = db.query(TaskClientAcceptance).one()
    assert record.accepted_by_user_id == data["portal"].id and record.manifest_hash == second["manifest_hash"]
    assert db.query(CompanyMembership).filter_by(user_id=data["portal"].id).count() == 0
    repeated = client.post(portal_url(data) + f"/{second['id']}/acceptance", headers=data["portal_headers"], json=consent(second))
    assert repeated.status_code == 200 and db.query(TaskClientAcceptance).count() == 1
    assert db.query(AuditLog).filter_by(action="task.client_accepted").count() == 1
    third = publish(client, data, summary="Tercera revisión", reports=[])
    current = client.get(portal_url(data), headers=data["portal_headers"]).json()["items"][0]
    assert current["id"] == third["id"] and current["acceptance"] is None
    assert current["previous_acceptances"][0]["revision"] == second["revision"]
    history = client.get(portal_url(data) + f"/{third['id']}/history", headers=data["portal_headers"])
    assert history.status_code == 200 and history.json()["items"][0]["revision"] == second["revision"]
    assert db.get(TaskClientPublication, first["id"]).manifest_hash == first["manifest_hash"]


@pytest.mark.parametrize("state", ["withdrawn", "expired_grant", "revoked_grant"])
def test_withdrawal_or_expired_access_blocks_parts_media_and_validation(client, db, state):
    data = setup(client, db, "publication-" + state)
    part = publish(client, data)
    photo_id = part["manifest"]["photos"][0]["id"]
    if state == "withdrawn":
        result = client.post(manager_url(data) + "/revoke", headers=data["headers"], json={"expected_revision": part["revision"], "confirmed": True})
        assert result.status_code == 200 and result.json()["is_public"] is False
        assert client.get(portal_url(data), headers=data["portal_headers"]).json()["items"] == []
        assert client.get(manager_url(data) + "/pdf", headers=data["headers"]).status_code == 200
        status = 404
    else:
        if state == "expired_grant": data["grant"].expires_at = datetime.now(timezone.utc)-timedelta(seconds=1)
        else: data["grant"].status = "revoked"
        db.commit(); status = 403
    assert client.get(portal_url(data) + f"/{part['id']}/photos/{photo_id}", headers=data["portal_headers"]).status_code == status
    assert client.post(portal_url(data) + f"/{part['id']}/acceptance", headers=data["portal_headers"], json=consent(part)).status_code == status
    assert db.query(TaskClientAcceptance).count() == 0


def test_reviewed_source_and_explicit_confirmation_are_required(client, db):
    data = setup(client, db, "stale-source")
    state = client.get(manager_url(data), headers=data["headers"]).json()
    body = {"public_summary": "Texto público", "checklist_item_ids": [], "report_ids": [data["reports"][0].id], "expected_revision": 0, "expected_source_hash": state["source_hash"], "confirmed_publication": True}
    assert client.post(manager_url(data), headers=data["headers"], json={**body, "confirmed_publication": False}).status_code == 422
    assert client.post(manager_url(data), headers=data["headers"], json={**body, "client_id": 999}).status_code == 422
    data["reports"][0].description = "Cambio desde otra sesión"; db.commit()
    assert client.post(manager_url(data), headers=data["headers"], json=body).status_code == 409
    assert db.query(TaskClientPublication).count() == 0


def test_failed_photo_copy_rolls_back_database_and_new_private_objects(client, db, tmp_path):
    data = setup(client, db, "copy-rollback")
    bad = TaskReport(task_item_id=data["task"].id, reporter_user_id=data["owner"].id, reporter_company_id=data["company"].id,
        reporter_name="Responsable", client_event_id=str(uuid4()), report_type="photo", media_key=build_media_key(data["company"].id, "task-report", "png"))
    db.add(bad); db.commit()
    state = client.get(manager_url(data), headers=data["headers"]).json()
    body = {"public_summary": "Fallará la segunda copia", "checklist_item_ids": [], "report_ids": [data["photo"].id, bad.id], "expected_revision": 0, "expected_source_hash": state["source_hash"], "confirmed_publication": True}
    result = client.post(manager_url(data), headers=data["headers"], json=body)
    assert result.status_code == 422, result.text
    assert db.query(TaskClientPublication).count() == 0 and db.query(TaskClientPublicationPhoto).count() == 0
    from pathlib import Path
    assert not list((Path(settings.MEDIA_STORAGE_PATH) / "company" / str(data["company"].id) / "client-work-publications").glob("*"))


def test_published_manifest_and_media_digests_are_verified_before_serving(client, db):
    data = setup(client, db, "integrity")
    part = publish(client, data)
    photo_id = part["manifest"]["photos"][0]["id"]
    photo = db.get(TaskClientPublicationPhoto, photo_id)
    get_object_storage().put(photo.media_key, b"changed content", photo.content_type)
    assert client.get(portal_url(data) + f"/{part['id']}/photos/{photo_id}", headers=data["portal_headers"]).status_code == 409
    stored = db.get(TaskClientPublication, part["id"]); stored.manifest = {**stored.manifest, "public_summary": "Alterado sin revisión"}; db.commit()
    assert client.get(portal_url(data) + f"/{part['id']}", headers=data["portal_headers"]).status_code == 409
    assert client.post(portal_url(data) + f"/{part['id']}/acceptance", headers=data["portal_headers"], json=consent(part)).status_code == 409
    assert db.query(TaskClientAcceptance).count() == 0
