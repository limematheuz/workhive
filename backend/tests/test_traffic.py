from app.api.v1 import traffic as traffic_api


def test_public_page_views_do_not_trigger_ip_geolocation(client, monkeypatch):
    observed: dict[str, bool] = {}

    def request_details(request, *, include_geolocation=True):
        del request
        observed["include_geolocation"] = include_geolocation
        return {
            "ip": "198.51.100.10",
            "user_agent": "WorkHive test",
            "accept_language": "es",
            "geo": {},
        }

    monkeypatch.setattr(traffic_api, "get_request_location_details", request_details)

    response = client.post(
        "/api/v1/traffic/page-view",
        json={
            "visitor_id": "visitor-identifier-123",
            "path": "/",
            "title": "WorkHive",
        },
    )

    assert response.status_code == 202
    assert observed == {"include_geolocation": False}
