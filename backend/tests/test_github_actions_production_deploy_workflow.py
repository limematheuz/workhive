import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "deploy-production.yml"
CONFIGURE_AWS_CREDENTIALS_SHA = "517a711dbcd0e402f90c77e7e2f81e849156e31d"
COMMIT_SHA_PATTERN = re.compile(r"^[^@]+@[0-9a-f]{40}$")


def load_workflow() -> dict:
    return yaml.load(WORKFLOW_PATH.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def workflow_steps(workflow: dict) -> list[dict]:
    return workflow["jobs"]["deploy"]["steps"]


def test_production_deployment_is_manual_main_only_and_serialized():
    workflow = load_workflow()

    assert workflow["on"]["workflow_dispatch"]["inputs"]["release_tag"]["required"] == "true"
    assert workflow["jobs"]["deploy"]["if"] == "github.ref == 'refs/heads/main'"
    assert workflow["concurrency"] == {
        "group": "workhive-production-deploy",
        "cancel-in-progress": "false",
    }


def test_production_deployment_uses_dedicated_short_lived_oidc_credentials():
    workflow = load_workflow()
    credentials_step = workflow_steps(workflow)[1]
    source = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert workflow["permissions"] == {"contents": "read", "id-token": "write"}
    assert credentials_step["uses"] == (
        f"aws-actions/configure-aws-credentials@{CONFIGURE_AWS_CREDENTIALS_SHA}"
    )
    assert credentials_step["with"] == {
        "role-to-assume": "${{ vars.AWS_DEPLOY_ROLE_ARN }}",
        "aws-region": "${{ vars.AWS_REGION }}",
        "role-session-name": "workhive-production-deploy-${{ github.run_id }}",
        "role-duration-seconds": "1800",
        "mask-aws-account-id": "true",
    }
    assert "secrets." not in source
    assert "AWS_ACCESS_KEY_ID" not in source
    assert "AWS_SECRET_ACCESS_KEY" not in source


def test_production_deployment_can_only_request_the_custom_document_for_one_instance():
    workflow = load_workflow()
    request_step = workflow_steps(workflow)[2]
    command = request_step["run"]

    assert "aws ssm send-command" in command
    assert "--document-name WorkHiveProductionDeploy" in command
    assert '--instance-ids "$INSTANCE_ID"' in command
    assert request_step["env"]["INSTANCE_ID"] == (
        "${{ vars.PRODUCTION_EC2_INSTANCE_ID }}"
    )
    assert '--parameters "ReleaseTag=${RELEASE_TAG}"' in command
    assert "AWS-RunShellScript" not in command
    assert "--commands" not in command
    assert "ssh " not in command


def test_production_deployment_defends_against_invalid_input_and_waits_for_ssm_result():
    workflow = load_workflow()
    validate_step = workflow_steps(workflow)[0]
    wait_step = workflow_steps(workflow)[3]

    assert "^v(0|[1-9][0-9]*)" in validate_step["run"]
    assert "aws ssm get-command-invocation" in wait_step["run"]
    assert "Success)" in wait_step["run"]
    assert "Pending|InProgress|Delayed" in wait_step["run"]
    assert "Timed out waiting for the production deployment result" in wait_step["run"]


def test_production_deployment_pins_every_third_party_action_to_a_commit_sha():
    workflow = load_workflow()
    action_uses = [step["uses"] for step in workflow_steps(workflow) if "uses" in step]

    assert action_uses
    assert all(COMMIT_SHA_PATTERN.fullmatch(action) for action in action_uses)
