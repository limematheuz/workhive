#!/usr/bin/env bash
set -euo pipefail

# The real deployment command requires root by design. This test verifies its
# static security contract without granting a CI runner access to AWS or Docker.

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_under_test="${repository_root}/ops/deploy/deploy_ecr_release.sh"
compose_override="${repository_root}/docker-compose.production.yml"
automatic_workflow="${repository_root}/.github/workflows/deploy-main-production.yml"
ssm_document="${repository_root}/ops/deploy/workhive-production-deploy.ssm.yaml"

bash -n "${script_under_test}"

grep -Fq 'build: !reset null' "${compose_override}"
grep -Fq 'image: ${BACKEND_IMAGE:?Define BACKEND_IMAGE}' "${compose_override}"
grep -Fq 'image: ${FRONTEND_IMAGE:?Define FRONTEND_IMAGE}' "${compose_override}"

grep -Fq 'workhive-backup.service' "${script_under_test}"
grep -Fq '[0-9a-f]{40}' "${script_under_test}"
grep -Fq 'ecr get-login-password' "${script_under_test}"
grep -Fq 'docker_bin}" login --username AWS --password-stdin' "${script_under_test}"
grep -Fq 'DOCKER_CONFIG="${docker_config_directory}"' "${script_under_test}"
grep -Fq 'ecr describe-images' "${script_under_test}"
grep -Fq 'Synchronizing production runtime configuration to ${release_ref}.' "${script_under_test}"
grep -Fq 'status --porcelain --untracked-files=no' "${script_under_test}"
grep -Fq 'env HOME="${workhive_owner_home}"' "${script_under_test}"
grep -Fq 'refs/heads/main:refs/remotes/origin/main' "${script_under_test}"
grep -Fq 'refs/tags/${release_ref}:refs/tags/${release_ref}' "${script_under_test}"
grep -Fq 'cat-file -t "refs/tags/${release_ref}"' "${script_under_test}"
grep -Fq 'merge-base --is-ancestor' "${script_under_test}"
grep -Fq 'checkout --detach "${release_commit}"' "${script_under_test}"
grep -Fq 'restore_source_checkout' "${script_under_test}"
grep -Fq 'up -d --no-build --wait --wait-timeout 180 backend frontend caddy' "${script_under_test}"
grep -Fq 'rollback "${previous_backend_image}" "${previous_frontend_image}"' "${script_under_test}"
grep -Fq 'recover_local_compose_images' "${script_under_test}"
grep -Fq 'alembic current' "${script_under_test}"
grep -Fq 'EDGE_TLS_TERMINATED must be true or false.' "${script_under_test}"
grep -Fq 'ops/security/docker-compose.alb.yml' "${script_under_test}"
grep -Fq 'http://${domain}/health' "${script_under_test}"
grep -Fq 'RELEASE_REF=${release_ref}' "${script_under_test}"

grep -Fq 'name: Deploy main to production' "${automatic_workflow}"
grep -Fq 'Require successful main checks' "${automatic_workflow}"
grep -Fq 'name: production' "${automatic_workflow}"
grep -Fq 'ReleaseRef=${RELEASE_REF}' "${automatic_workflow}"
grep -Fq 'cancel-in-progress: false' "${automatic_workflow}"

grep -Fq 'ReleaseRef:' "${ssm_document}"
grep -Fq '[0-9a-f]{40}' "${ssm_document}"
grep -Fq 'SSM_ReleaseRef' "${ssm_document}"

if grep -Eq '(^|[[:space:]])up[[:space:]].*--build' "${script_under_test}"; then
    echo 'Deployment script must never build application images on EC2.' >&2
    exit 1
fi

if grep -Eq 'AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)' "${script_under_test}"; then
    echo 'Deployment script must not use static AWS credentials.' >&2
    exit 1
fi

echo 'ECR deployment automation contract passed'
