from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
DOCUMENT_PATH = ROOT / "ops" / "deploy" / "workhive-production-deploy.ssm.yaml"


def load_document() -> dict:
    return yaml.safe_load(DOCUMENT_PATH.read_text(encoding="utf-8"))


def test_ssm_production_deploy_document_uses_a_sh_compatible_bash_launcher():
    document = load_document()
    command = document["mainSteps"][0]["inputs"]["runCommand"][0]

    assert document["schemaVersion"] == "2.2"
    assert document["parameters"]["ReleaseTag"]["interpolationType"] == "ENV_VAR"
    assert document["parameters"]["ReleaseTag"]["allowedPattern"] == (
        r"^v[0-9]+\.[0-9]+\.[0-9]+$"
    )
    assert "set -eu" in command
    assert "pipefail" not in command
    assert 'release_tag="${SSM_ReleaseTag:?ReleaseTag is required}"' in command
    assert "docker builder prune --all --force" in command
    assert "docker image prune --all --force" in command
    assert "docker container prune --force" in command
    assert "volume prune" not in command
    assert "exec /bin/bash /home/ubuntu/workhive/ops/deploy/deploy_ecr_release.sh" in command
