import re

from app.main import app
from app.models.company import Company
from app.models.task_item import TaskItem
from app.models.user import User
from app.models.work_session import WorkSession
from tests.test_client_portal_api import _grant, _portal_user
from tests.test_partner_portal_api import _portal_context


def malformed_parameter_value(schema):
    if "$ref" in schema:
        return malformed_parameter_value(
            app.openapi()["components"]["schemas"][schema["$ref"].rsplit("/", 1)[-1]]
        )
    for candidate in schema.get("anyOf", [schema]):
        kind = candidate.get("type")
        if kind in {"integer", "number", "boolean"}:
            return "not-a-valid-value"
        if kind == "array":
            return malformed_parameter_value(candidate.get("items", {}))
        if candidate.get("enum"):
            return "__invalid_enum_value__"
        if candidate.get("format") in {"date", "date-time", "uuid"}:
            return "not-a-valid-value"
        if "maxLength" in candidate:
            return "x" * (candidate["maxLength"] + 1)
        if candidate.get("minLength", 0) > 0:
            return ""
    return None


def test_documented_typed_inputs_reject_malformed_values_without_mutation(
    client, db, api_workspace
):
    partner = _portal_context(db, suffix="invalid-inputs")
    portal, portal_headers = _portal_user(
        db, email="invalid-inputs-portal@example.com", suffix="invalid-inputs"
    )
    portal_grant = _grant(
        db,
        company=api_workspace.company,
        customer=api_workspace.client,
        user=portal,
        admin=api_workspace.admin,
    )
    db.commit()
    key = client.post(
        "/api/v1/api-access-keys/",
        headers=api_workspace.headers["admin"],
        json={
            "name": "QA malformed input contract",
            "scopes": ["work_orders.read", "reservations.write"],
        },
    )
    assert key.status_code == 201, key.text
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
            }:
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
            elif path.startswith("/api/v1/public/"):
                kwargs["headers"] = {"X-WorkHive-API-Key": key.json()["api_key"]}
            if definition.get("requestBody"):
                kwargs["content"] = b"{malformed-json"
                kwargs["headers"]["Content-Type"] = "application/json"
            else:
                invalid = next(
                    (
                        parameter
                        for parameter in definition.get("parameters", [])
                        if malformed_parameter_value(parameter.get("schema", {}))
                        is not None
                    ),
                    None,
                )
                if invalid is None:
                    continue  # No typed input to make malformed; business-state cases have focused tests.
                if invalid["in"] == "path":
                    target = path.replace(
                        "{" + invalid["name"] + "}",
                        malformed_parameter_value(invalid["schema"]),
                    )
                    target = re.sub(r"\{[^}]+\}", "999999999", target)
                elif invalid["in"] == "query":
                    kwargs["params"] = {
                        invalid["name"]: malformed_parameter_value(invalid["schema"])
                    }
                else:
                    continue
            if path.startswith("/api/v1/client-portal/workspaces/"):
                target = target.replace(
                    "/workspaces/999999999/", f"/workspaces/{portal_grant.id}/"
                )
            response = client.request(method.upper(), target, **kwargs)
            # Integer path converters reject the route itself before validation.
            assert response.status_code in {422, 404}, (
                f"{method.upper()} {path}: {response.status_code} {response.text}"
            )
            tested.append((method, path))
    assert len(tested) > 250
    assert {model: db.query(model).count() for model in before} == before
