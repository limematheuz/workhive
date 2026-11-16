from datetime import datetime, timedelta, timezone

from app.models.trial_request import TrialRequest
from app.models.work_session import WorkSession


def test_closed_shift_correction_requires_a_different_authorized_reviewer(
    client, db, api_workspace
):
    qa = api_workspace
    started = datetime.now(timezone.utc) - timedelta(hours=2)
    session = WorkSession(
        user_id=qa.worker.id,
        location_id=qa.location.id,
        task_item_id=qa.task.id,
        start_time=started,
        end_time=started + timedelta(hours=1),
    )
    db.add(session)
    db.commit()
    payload = {
        "requested_start_time": started.isoformat(),
        "requested_end_time": (started + timedelta(minutes=30)).isoformat(),
        "reason": "QA correction of recorded duration",
    }
    path = f"/api/v1/work-session-corrections/sessions/{session.id}"
    assert (
        client.post(path, headers=qa.headers["outsider"], json=payload).status_code
        == 404
    )
    requested = client.post(path, headers=qa.headers["worker"], json=payload)
    assert requested.status_code == 201, requested.text
    review = f"/api/v1/work-session-corrections/{requested.json()['id']}/review"
    assert (
        client.post(
            review, headers=qa.headers["worker"], json={"decision": "approved"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            review, headers=qa.headers["outsider"], json={"decision": "approved"}
        ).status_code
        == 404
    )
    approved = client.post(
        review,
        headers=qa.headers["admin"],
        json={"decision": "approved", "note": "Reviewed in QA"},
    )
    assert approved.status_code == 200 and approved.json()["status"] == "approved", (
        approved.text
    )
    db.refresh(session)
    assert session.end_time.replace(tzinfo=timezone.utc) == started + timedelta(
        minutes=30
    )
    assert (
        client.post(
            review, headers=qa.headers["admin"], json={"decision": "approved"}
        ).status_code
        == 409
    )


def test_only_platform_can_reject_a_trial_without_creating_a_company(
    client, db, api_workspace
):
    qa = api_workspace
    request = TrialRequest(
        full_name="QA applicant",
        email="qa-applicant@example.com",
        company_name="QA proposed company",
        status="email_verified",
        verification_token_hash="0" * 64,
        verification_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(request)
    db.commit()
    path = f"/api/v1/trial-requests/{request.id}/reject"
    assert (
        client.post(
            path, headers=qa.headers["admin"], json={"note": "QA rejected"}
        ).status_code
        == 403
    )
    rejected = client.post(
        path, headers=qa.headers["platform"], json={"note": "QA rejected"}
    )
    assert rejected.status_code == 200 and rejected.json()["status"] == "rejected", (
        rejected.text
    )
    db.refresh(request)
    assert request.created_company_id is None and request.created_user_id is None
