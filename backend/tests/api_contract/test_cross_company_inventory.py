from app.main import app
from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from app.models.task_item import TaskItem
from app.models.user import User


def test_foreign_admin_cannot_read_or_delete_existing_operational_parents(
    client, db, api_workspace
):
    qa = api_workspace
    parents = {
        "company_id": qa.company.id,
        "client_id": qa.client.id,
        "location_id": qa.location.id,
        "task_item_id": qa.task.id,
        "user_id": qa.worker.id,
    }
    models = [Company, Client, Location, TaskItem, User]
    before = {model: db.query(model).count() for model in models}
    tested = []
    for path, operations in app.openapi()["paths"].items():
        for method, definition in operations.items():
            parameters = [
                p for p in definition.get("parameters", []) if p.get("in") == "path"
            ]
            if (
                method.upper() not in {"GET", "DELETE"}
                or len(parameters) != 1
                or parameters[0]["name"] not in parents
            ):
                continue
            if not definition.get("security") or path.startswith(
                ("/api/v1/client-portal/", "/api/v1/partner-portal/")
            ):
                continue  # Portal grants have separate principals and dedicated isolation tests.
            name = parameters[0]["name"]
            target = path.replace("{" + name + "}", str(parents[name]))
            response = client.request(
                method.upper(),
                target,
                headers=qa.headers["outsider"],
                follow_redirects=False,
            )
            assert response.status_code in {403, 404}, (
                f"{method.upper()} {path}: {response.status_code} {response.text}"
            )
            tested.append((method, path))
    assert len(tested) >= 25
    assert {model: db.query(model).count() for model in models} == before
    for row in [qa.company, qa.client, qa.location, qa.task, qa.worker]:
        db.refresh(row)
    assert qa.company.is_active and qa.location.is_active and qa.worker.is_active
    assert qa.task.status == "accepted"
