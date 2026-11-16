import re

from app.main import app
from app.models.company import Company
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession


def test_every_documented_protected_operation_rejects_anonymous_access(client, db):
    tested = []
    for path, operations in app.openapi()["paths"].items():
        for method, definition in operations.items():
            if method.upper() not in {
                "GET",
                "POST",
                "PATCH",
                "PUT",
                "DELETE",
            } or not definition.get("security"):
                continue
            target = re.sub(r"\{[^}]+\}", "999999999", path)
            response = client.request(
                method.upper(),
                target,
                json={} if method.upper() not in {"GET", "DELETE"} else None,
                follow_redirects=False,
            )
            assert response.status_code == 401, (
                f"{method.upper()} {path}: {response.status_code} {response.text}"
            )
            tested.append((method.upper(), path))
    assert tested
    for model in (User, Company, TaskItem, WorkSession):
        assert db.query(model).count() == 0
