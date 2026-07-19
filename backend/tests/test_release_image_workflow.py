import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "publish-release-images.yml"
COMMIT_SHA_PATTERN = re.compile(r"^[^@]+@[0-9a-f]{40}$")


def load_workflow() -> dict:
    return yaml.load(WORKFLOW_PATH.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def workflow_steps(workflow: dict) -> list[dict]:
    return [
        step
        for job in workflow["jobs"].values()
        for step in job.get("steps", [])
    ]


def test_release_publication_is_manual_and_does_not_cancel_an_active_publish():
    workflow = load_workflow()
    dispatch = workflow["on"]["workflow_dispatch"]

    assert dispatch["inputs"]["release_tag"]["required"] == "true"
    assert dispatch["inputs"]["release_tag"]["type"] == "string"
    assert workflow["concurrency"]["cancel-in-progress"] == "false"


def test_release_validation_requires_main_annotated_semver_tag_and_matching_version():
    workflow = load_workflow()
    command = workflow["jobs"]["release-metadata"]["steps"][1]["run"]

    assert '"$GITHUB_REF" != "refs/heads/main"' in command
    assert "^v(0|[1-9][0-9]*)" in command
    assert 'git cat-file -t "refs/tags/${RELEASE_TAG}"' in command
    assert '!= "tag"' in command
    assert "git merge-base --is-ancestor" in command
    assert 'git show "${git_sha}:VERSION"' in command
    assert '"v${version}" != "$RELEASE_TAG"' in command


def test_release_requires_existing_ci_frontend_security_and_react_checks():
    workflow = load_workflow()
    command = workflow["jobs"]["verified-checks"]["steps"][0]["run"]

    for required_check in (
        "Backend tests",
        "Frontend checks",
        "Secrets & misconfig (Trivy)",
        "Python SAST & dependencies",
        "react-doctor",
    ):
        assert f'"{required_check}"' in command

    assert 'if [[ "$conclusion" != "success" ]]' in command
    assert workflow["jobs"]["publish"]["needs"] == [
        "release-metadata",
        "verified-checks",
    ]


def test_aws_credentials_are_short_lived_and_static_keys_are_not_used():
    workflow = load_workflow()
    publish = workflow["jobs"]["publish"]
    source = WORKFLOW_PATH.read_text(encoding="utf-8")

    assert workflow["permissions"] == {"contents": "read", "checks": "read"}
    assert publish["permissions"] == {"contents": "read", "id-token": "write"}
    assert "secrets." not in source
    assert "AWS_ACCESS_KEY_ID" not in source
    assert "AWS_SECRET_ACCESS_KEY" not in source
    assert "mask-aws-account-id: true" in source
    assert "role-duration-seconds: 2700" in source


def test_every_third_party_action_is_pinned_to_a_full_commit_sha():
    workflow = load_workflow()
    action_uses = [step["uses"] for step in workflow_steps(workflow) if "uses" in step]

    assert action_uses
    assert all(COMMIT_SHA_PATTERN.fullmatch(action) for action in action_uses)


def test_images_use_sha_and_release_tags_but_never_latest():
    workflow = load_workflow()
    source = WORKFLOW_PATH.read_text(encoding="utf-8")
    publish_steps = workflow["jobs"]["publish"]["steps"]
    build_steps = [step for step in publish_steps if step["name"].startswith("Build and publish")]

    assert len(build_steps) == 2
    assert ":latest" not in source
    for step in build_steps:
        tags = step["with"]["tags"]
        assert ":${{ needs.release-metadata.outputs.git_sha }}" in tags
        assert ":${{ needs.release-metadata.outputs.release_tag }}" in tags
        assert step["with"]["push"] == "true"
        assert step["with"]["provenance"] == "false"
        assert step["with"]["sbom"] == "false"


def test_existing_tags_are_rejected_and_published_tags_are_verified():
    workflow = load_workflow()
    publish_steps = workflow["jobs"]["publish"]["steps"]
    reject = next(step for step in publish_steps if step["name"] == "Reject existing immutable tags")
    verify = next(step for step in publish_steps if step["name"] == "Verify published tags")

    assert "aws ecr batch-get-image" in reject["run"]
    assert 'if [[ "$image_count" != "0" ]]' in reject["run"]
    assert "aws ecr batch-get-image" in verify["run"]
    assert 'test "$image_count" = "1"' in verify["run"]


def test_version_metadata_is_injected_into_both_images():
    workflow = load_workflow()
    publish_steps = workflow["jobs"]["publish"]["steps"]
    backend = next(step for step in publish_steps if step["name"] == "Build and publish backend")
    frontend = next(step for step in publish_steps if step["name"] == "Build and publish frontend")

    assert "APP_VERSION=${{ needs.release-metadata.outputs.version }}" in backend["with"]["build-args"]
    assert "GIT_SHA=${{ needs.release-metadata.outputs.git_sha }}" in backend["with"]["build-args"]
    assert "NEXT_PUBLIC_APP_VERSION=${{ needs.release-metadata.outputs.version }}" in frontend["with"]["build-args"]
    assert "NEXT_PUBLIC_GIT_SHA=${{ needs.release-metadata.outputs.git_sha }}" in frontend["with"]["build-args"]
