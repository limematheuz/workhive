import re

from app.main import app
from app.models.company import Company
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from tests.test_client_portal_api import _grant, _portal_user
from tests.test_partner_portal_api import _portal_context


def test_documented_typed_inputs_reject_malformed_values_without_mutation(
    client, db, api_workspace
):
    partner = _portal_context(db, suffix="invalid-inputs")
    portal, portal_headers = _portal_user(
        db, email="invalid-inputs-portal@example.com", suffix="invalid-inputs"
    )
    _grant(
        db,
        company=api_workspace.company,
        customer=api_workspace.client,
        user=portal,
        admin=api_workspace.admin,
    )
    db.commit()
    before = {
        model: db.query(model).count()
        for model in (User, Company, TaskItem, WorkSession)
    }
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
            kwargs = {
                "headers": dict(api_workspace.headers["admin"]),
                "follow_redirects": False,
            }
            if path.startswith("/api/v1/partner-portal/") and not path.startswith(
                "/api/v1/partner-portal/collaborations/"
            ):
                kwargs["headers"] = dict(partner["partner_headers"])
            elif path.startswith("/api/v1/client-portal/workspaces/"):
                kwargs["headers"] = dict(portal_headers)
            if definition.get("requestBody"):
                kwargs["content"] = b"{malformed-json"
                kwargs["headers"]["Content-Type"] = "application/json"
            else:
                invalid = next(
                    (
                        parameter
                        for parameter in definition.get("parameters", [])
                        if parameter.get("schema", {}).get("type")
                        in {"integer", "number", "boolean"}
                    ),
                    None,
                )
                if invalid is None:
                    continue  # No typed input to make malformed; business-state cases have focused tests.
                if invalid["in"] == "path":
                    target = target.replace("999999999", "not-a-valid-integer", 1)
                elif invalid["in"] == "query":
                    kwargs["params"] = {invalid["name"]: "not-a-valid-value"}
                else:
                    continue
            response = client.request(method.upper(), target, **kwargs)
            # Integer path converters reject the route itself before validation.
            assert response.status_code in {422, 404}, (
                f"{method.upper()} {path}: {response.status_code} {response.text}"
            )
            tested.append((method, path))
    assert len(tested) > 250
    assert {model: db.query(model).count() for model in before} == before
