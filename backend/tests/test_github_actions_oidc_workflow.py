from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "aws-oidc-auth.yml"
CONFIGURE_AWS_CREDENTIALS_SHA = "517a711dbcd0e402f90c77e7e2f81e849156e31d"


def load_workflow() -> dict:
    return yaml.load(WORKFLOW_PATH.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def test_oidc_authentication_workflow_is_manual_and_main_only():
    workflow = load_workflow()

    assert workflow["on"] == {"workflow_dispatch": ""}
    assert workflow["permissions"] == {
        "contents": "read",
        "id-token": "write",
    }
    assert workflow["jobs"]["authenticate"]["if"] == (
        "github.ref == 'refs/heads/main'"
    )


def test_oidc_authentication_uses_short_lived_credentials_without_secrets():
    workflow = load_workflow()
    credential_step = workflow["jobs"]["authenticate"]["steps"][0]

    assert credential_step["uses"] == (
        f"aws-actions/configure-aws-credentials@{CONFIGURE_AWS_CREDENTIALS_SHA}"
    )
    assert credential_step["with"] == {
        "role-to-assume": "${{ vars.AWS_ROLE_ARN }}",
        "aws-region": "${{ vars.AWS_REGION }}",
        "role-session-name": "workhive-oidc-${{ github.run_id }}",
        "role-duration-seconds": "900",
        "mask-aws-account-id": "true",
    }

    workflow_source = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "secrets." not in workflow_source
    assert "AWS_ACCESS_KEY_ID" not in workflow_source
    assert "AWS_SECRET_ACCESS_KEY" not in workflow_source


def test_oidc_authentication_test_does_not_access_ecr_or_print_identity():
    workflow = load_workflow()
    verification_step = workflow["jobs"]["authenticate"]["steps"][1]
    command = verification_step["run"]

    assert "aws sts get-caller-identity >/dev/null" in command
    assert "aws ecr" not in command
    assert "get-caller-identity --output" not in command
