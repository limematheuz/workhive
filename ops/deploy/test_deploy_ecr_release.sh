#!/usr/bin/env bash
set -euo pipefail

# The real deployment command requires root by design. This test verifies its
# static security contract without granting a CI runner access to AWS or Docker.

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script_under_test="${repository_root}/ops/deploy/deploy_ecr_release.sh"
compose_override="${repository_root}/docker-compose.production.yml"

bash -n "${script_under_test}"

grep -Fq 'build: !reset null' "${compose_override}"
grep -Fq 'image: ${BACKEND_IMAGE:?Define BACKEND_IMAGE}' "${compose_override}"
grep -Fq 'image: ${FRONTEND_IMAGE:?Define FRONTEND_IMAGE}' "${compose_override}"

grep -Fq 'workhive-backup.service' "${script_under_test}"
grep -Fq '^v(0|[1-9][0-9]*)' "${script_under_test}"
grep -Fq 'ecr get-login-password' "${script_under_test}"
grep -Fq 'docker_bin}" login --username AWS --password-stdin' "${script_under_test}"
grep -Fq 'DOCKER_CONFIG="${docker_config_directory}"' "${script_under_test}"
grep -Fq 'ecr describe-images' "${script_under_test}"
grep -Fq 'up -d --no-build --wait --wait-timeout 180 backend frontend caddy' "${script_under_test}"
grep -Fq 'rollback "${previous_backend_image}" "${previous_frontend_image}"' "${script_under_test}"
grep -Fq 'recover_local_compose_images' "${script_under_test}"
grep -Fq 'alembic current' "${script_under_test}"
grep -Fq 'EDGE_TLS_TERMINATED must be true or false.' "${script_under_test}"
grep -Fq 'ops/security/docker-compose.alb.yml' "${script_under_test}"
grep -Fq 'http://${domain}/health' "${script_under_test}"

if grep -Eq '(^|[[:space:]])up[[:space:]].*--build' "${script_under_test}"; then
    echo 'Deployment script must never build application images on EC2.' >&2
    exit 1
fi

if grep -Eq 'AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY)' "${script_under_test}"; then
    echo 'Deployment script must not use static AWS credentials.' >&2
    exit 1
fi

echo 'ECR deployment automation contract passed'
