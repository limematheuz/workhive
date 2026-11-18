from uuid import uuid4
from pathlib import Path
from app.models.task_report import TaskReport
from app.models.staff_employee import StaffEmployee
from app.models.staff_account import StaffAccount
from app.models.company_membership import CompanyMembership
from app.models.offline_work import OfflineWork
from app.core.config import settings
from app.services.image_service import MAX_IMAGE_BYTES
from tests.test_task_notifications import _external_task, _headers, _user as _notification_user
from tests.test_task_report_center import _accept_external_task, _png
from tests.test_client_permission_authorization import _company, _bootstrap_admin


def _photo(client, user, task, event=None, content=None, expected=None, expected_company=None):
    return client.post("/api/v1/worker-workspace/photos", headers=_headers(user),
        data={"task_id":str(task), "expected_user_id":str(expected if expected is not None else user.id), "client_event_id":event or str(uuid4()),**({"expected_company_id":str(expected_company)} if expected_company is not None else {})},
        files={"file":("evidence.png", content if content is not None else _png(), "image/png")})


def test_worker_photo_retry_creates_one_private_report_and_cleans_staging(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    worker = users["receiver_viewer"]
    event = str(uuid4())
    created = _photo(client, worker, task.id, event)
    assert created.status_code == 201, created.text
    result = created.json()
    assert result["media_url"] == f"/api/v1/task-reports/{result['id']}/media"
    repeated = _photo(client, worker, task.id, event)
    assert repeated.status_code == 201, repeated.text
    assert repeated.json()["id"] == result["id"]
    assert db.query(TaskReport).filter_by(client_event_id=event).count() == 1
    downloaded = client.get(result["media_url"], headers=_headers(worker))
    assert downloaded.status_code == 200 and downloaded.content == _png()
    stored=db.get(TaskReport,result["id"])
    assert client.get("/api/v1/uploads/media/"+stored.media_key,headers=_headers(worker)).status_code==404
    assert client.get(result["media_url"], headers=_headers(users["unrelated_admin"])).status_code == 404
    assert not list(Path(settings.MEDIA_STORAGE_PATH).glob("company/*/worker-photo-staging/*"))


def test_worker_photo_rejects_changed_account_unassigned_task_foreign_company_and_invalid_bytes(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    worker = users["receiver_viewer"]
    assert _photo(client, worker, task.id, expected=users["receiver_admin"].id).status_code == 403
    assert _photo(client, worker, task.id, expected_company=worker.company_id+100).status_code == 403
    unassigned = _notification_user(db, users["receiver_admin"].company, "new-worker-admin@notify.test", 1)
    assert _photo(client, unassigned, task.id).status_code == 403
    assert _photo(client, users["unrelated_admin"], task.id).status_code == 404
    assert _photo(client, worker, task.id, content=b"%PDF-not-an-image").status_code == 400
    assert _photo(client, worker, task.id, content=b"x" * (MAX_IMAGE_BYTES + 1)).status_code == 413
    assert db.query(TaskReport).count() == 0


def test_worker_photo_idempotency_does_not_accept_different_bytes(client, db):
    users = _external_task(db)
    task = _accept_external_task(client, db, users)
    worker = users["receiver_viewer"]
    event = str(uuid4())
    assert _photo(client, worker, task.id, event).status_code == 201
    from io import BytesIO
    from PIL import Image
    output = BytesIO(); Image.new("RGB", (8,8), "red").save(output, format="PNG")
    conflict = _photo(client, worker, task.id, event, content=output.getvalue())
    assert conflict.status_code == 409, conflict.text
    assert db.query(TaskReport).filter_by(client_event_id=event).count() == 1


def test_worker_context_returns_only_own_link_and_never_creates_employees_or_accesses(client, db):
    company = _company(db, "worker-context")
    admin = _bootstrap_admin(db, company, "worker-context")
    before_members = db.query(CompanyMembership).count()
    empty = client.get("/api/v1/worker-workspace", headers=_headers(admin))
    assert empty.status_code == 200, empty.text
    assert empty.json()["employee"] is None
    assert db.query(StaffEmployee).count() == 0 and db.query(CompanyMembership).count() == before_members
    employee = StaffEmployee(company_id=company.id, name="Empleado vinculado", position="Limpieza", team="Norte", monthly_hours=160, hourly_cost=13579, profile={"gross":"987654", "documents":[]})
    db.add(employee); db.flush()
    db.add(StaffAccount(company_id=company.id, user_id=admin.id, employee_id=employee.id)); db.commit()
    own = client.get("/api/v1/worker-workspace?user_id=999999", headers=_headers(admin))
    assert own.status_code == 200, own.text
    assert own.json()["employee"] == {"id":employee.id, "name":"Empleado vinculado", "position":"Limpieza"}
    assert "13579" not in own.text and "987654" not in own.text and "documents" not in own.text
    membership = db.query(CompanyMembership).filter_by(company_id=company.id, user_id=admin.id).one()
    membership.status = "suspended"; db.commit()
    assert client.get("/api/v1/worker-workspace", headers=_headers(admin)).status_code == 403


def test_expected_account_guard_also_rejects_offline_hours_before_writing(client, db):
    company = _company(db, "worker-account-guard")
    admin = _bootstrap_admin(db, company, "worker-account-guard")
    response = client.post("/api/v1/offline-work", headers=_headers(admin), json={"event_id":str(uuid4()), "task_id":1,
        "expected_user_id":admin.id + 100, "starts_at":"2026-11-16T08:00:00Z", "ends_at":"2026-11-16T10:00:00Z", "description":"Parte de cuenta anterior"})
    assert response.status_code == 403, response.text
    company_changed=client.post("/api/v1/offline-work",headers=_headers(admin),json={"event_id":str(uuid4()),"task_id":1,"expected_user_id":admin.id,"expected_company_id":company.id+100,"starts_at":"2026-11-16T08:00:00Z","ends_at":"2026-11-16T10:00:00Z","description":"Parte del espacio anterior"})
    assert company_changed.status_code==403,company_changed.text
    assert db.query(OfflineWork).count() == 0
