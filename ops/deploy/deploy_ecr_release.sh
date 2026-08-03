#!/usr/bin/env bash
set -euo pipefail

# Manually deploy one immutable vMAJOR.MINOR.PATCH ECR release to production.
# The script is intentionally host-oriented: its real configuration and state
# live outside Git in /etc/workhive and it never needs persistent AWS keys.

umask 077

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this deployment command with sudo." >&2
    exit 1
fi

if [[ "${#}" -ne 1 || ! "${1}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
    echo "Usage: sudo $0 vMAJOR.MINOR.PATCH" >&2
    exit 1
fi

release_tag="${1}"
deploy_env_file="${DEPLOY_ENV_FILE:-/etc/workhive/deploy.env}"
deployment_state_file="${DEPLOYMENT_STATE_FILE:-/etc/workhive/deployed-release.env}"
lock_file="${DEPLOY_LOCK_FILE:-/run/lock/workhive-ecr-deploy.lock}"

if [[ ! -f "${deploy_env_file}" ]]; then
    echo "Deployment configuration not found: ${deploy_env_file}" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "${deploy_env_file}"
set +a

workhive_dir="${WORKHIVE_DIR:-/home/ubuntu/workhive}"
compose_env_file="${COMPOSE_ENV_FILE:-${workhive_dir}/.env}"
edge_tls_terminated="${EDGE_TLS_TERMINATED:-false}"
aws_region="${AWS_REGION:-eu-west-1}"
aws_bin="${AWS_BIN:-/snap/bin/aws}"
docker_bin="${DOCKER_BIN:-docker}"
systemctl_bin="${SYSTEMCTL_BIN:-systemctl}"
curl_bin="${CURL_BIN:-curl}"
flock_bin="${FLOCK_BIN:-flock}"

for required_file in \
    "${workhive_dir}/docker-compose.yml" \
    "${workhive_dir}/docker-compose.production.yml" \
    "${compose_env_file}"; do
    if [[ ! -f "${required_file}" ]]; then
        echo "Required file not found: ${required_file}" >&2
        exit 1
    fi
done

case "${edge_tls_terminated}" in
    true|false)
        ;;
    *)
        echo "EDGE_TLS_TERMINATED must be true or false." >&2
        exit 1
        ;;
esac

edge_compose_file="${workhive_dir}/ops/security/docker-compose.alb.yml"
if [[ "${edge_tls_terminated}" == "true" && ! -f "${edge_compose_file}" ]]; then
    echo "Required edge configuration not found: ${edge_compose_file}" >&2
    exit 1
fi

for required_command in \
    "${aws_bin}" \
    "${docker_bin}" \
    "${systemctl_bin}" \
    "${curl_bin}" \
    "${flock_bin}"; do
    if ! command -v "${required_command}" >/dev/null 2>&1; then
        echo "Required command not found: ${required_command}" >&2
        exit 1
    fi
done

mkdir -p "$(dirname "${lock_file}")" "$(dirname "${deployment_state_file}")"
exec 9>"${lock_file}"
if ! "${flock_bin}" -n 9; then
    echo "Another WorkHive deployment is already running; exiting safely." >&2
    exit 1
fi

compose_files=(
    -f "${workhive_dir}/docker-compose.yml"
    -f "${workhive_dir}/docker-compose.production.yml"
)
if [[ "${edge_tls_terminated}" == "true" ]]; then
    compose_files+=(-f "${edge_compose_file}")
fi

compose_base=(
    "${docker_bin}" compose
    -f "${workhive_dir}/docker-compose.yml"
)
if [[ "${edge_tls_terminated}" == "true" ]]; then
    compose_base+=(-f "${edge_compose_file}")
fi
compose_base+=(--env-file "${compose_env_file}")

compose_production=(
    "${docker_bin}" compose
    "${compose_files[@]}"
    --env-file "${compose_env_file}"
)

docker_config_directory="$(mktemp -d)"
cleanup() {
    rm -rf -- "${docker_config_directory}"
}
trap cleanup EXIT
export DOCKER_CONFIG="${docker_config_directory}"

account_id="$("${aws_bin}" sts get-caller-identity --query Account --output text --region "${aws_region}")"
if [[ ! "${account_id}" =~ ^[0-9]{12}$ ]]; then
    echo "Could not resolve the AWS account for the EC2 instance role." >&2
    exit 1
fi
registry="${account_id}.dkr.ecr.${aws_region}.amazonaws.com"
target_backend_image="${registry}/workhive/backend:${release_tag}"
target_frontend_image="${registry}/workhive/frontend:${release_tag}"

previous_backend_image=""
previous_frontend_image=""
if [[ -f "${deployment_state_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${deployment_state_file}"
    set +a
    previous_backend_image="${BACKEND_IMAGE:-}"
    previous_frontend_image="${FRONTEND_IMAGE:-}"
fi

validate_images_exist() {
    for repository in workhive/backend workhive/frontend; do
        "${aws_bin}" ecr describe-images \
            --region "${aws_region}" \
            --repository-name "${repository}" \
            --image-ids "imageTag=${release_tag}" \
            >/dev/null
    done
}

ecr_login() {
    "${aws_bin}" ecr get-login-password --region "${aws_region}" \
        | "${docker_bin}" login --username AWS --password-stdin "${registry}" >/dev/null
}

health_check() {
    local domain

    domain="$(sed -n 's/^APP_DOMAIN=//p' "${compose_env_file}" | tail -n 1)"
    if [[ -z "${domain}" ]]; then
        echo "APP_DOMAIN is missing from ${compose_env_file}" >&2
        return 1
    fi

    BACKEND_IMAGE="${1}" FRONTEND_IMAGE="${2}" "${compose_production[@]}" ps --status running \
        | grep -q 'backend'
    BACKEND_IMAGE="${1}" FRONTEND_IMAGE="${2}" "${compose_production[@]}" ps --status running \
        | grep -q 'frontend'

    if [[ "${edge_tls_terminated}" == "true" ]]; then
        "${curl_bin}" --fail --silent --show-error \
            --resolve "${domain}:80:127.0.0.1" \
            "http://${domain}/health" >/dev/null
        "${curl_bin}" --fail --silent --show-error \
            --resolve "${domain}:80:127.0.0.1" \
            "http://${domain}/login" >/dev/null
    else
        "${curl_bin}" --fail --silent --show-error \
            --resolve "${domain}:443:127.0.0.1" \
            "https://${domain}/health" >/dev/null
        "${curl_bin}" --fail --silent --show-error \
            --resolve "${domain}:443:127.0.0.1" \
            "https://${domain}/login" >/dev/null
    fi
    BACKEND_IMAGE="${1}" FRONTEND_IMAGE="${2}" "${compose_production[@]}" exec -T backend alembic current >/dev/null
}

rollback() {
    local rollback_backend="$1"
    local rollback_frontend="$2"

    echo "Deployment validation failed; restoring the previous application images." >&2
    BACKEND_IMAGE="${rollback_backend}" FRONTEND_IMAGE="${rollback_frontend}" \
        "${compose_production[@]}" pull backend frontend
    BACKEND_IMAGE="${rollback_backend}" FRONTEND_IMAGE="${rollback_frontend}" \
        "${compose_production[@]}" up -d --no-build --wait --wait-timeout 180 backend frontend caddy
    health_check "${rollback_backend}" "${rollback_frontend}"
}

recover_local_compose_images() {
    echo "Deployment validation failed; restoring the locally retained application images." >&2
    "${compose_base[@]}" up -d --no-build --wait --wait-timeout 180 backend frontend caddy
}

echo "Creating a fresh verified backup before deployment."
"${systemctl_bin}" start workhive-backup.service
"${systemctl_bin}" is-active --quiet workhive-backup.timer

echo "Verifying immutable release images."
validate_images_exist
ecr_login

echo "Validating production Compose configuration."
BACKEND_IMAGE="${target_backend_image}" FRONTEND_IMAGE="${target_frontend_image}" \
    "${compose_production[@]}" config >/dev/null

echo "Pulling release ${release_tag} from ECR."
BACKEND_IMAGE="${target_backend_image}" FRONTEND_IMAGE="${target_frontend_image}" \
    "${compose_production[@]}" pull backend frontend

echo "Starting release ${release_tag} without building on EC2."
if ! BACKEND_IMAGE="${target_backend_image}" FRONTEND_IMAGE="${target_frontend_image}" \
    "${compose_production[@]}" up -d --no-build --wait --wait-timeout 180 backend frontend caddy; then
    if [[ -n "${previous_backend_image}" && -n "${previous_frontend_image}" ]]; then
        rollback "${previous_backend_image}" "${previous_frontend_image}"
    else
        recover_local_compose_images
    fi
    exit 1
fi

if ! health_check "${target_backend_image}" "${target_frontend_image}"; then
    if [[ -n "${previous_backend_image}" && -n "${previous_frontend_image}" ]]; then
        rollback "${previous_backend_image}" "${previous_frontend_image}"
    else
        recover_local_compose_images
    fi
    exit 1
fi

state_file_temporary="$(mktemp "${deployment_state_file}.tmp.XXXXXX")"
cat > "${state_file_temporary}" <<EOF
# Managed by deploy_ecr_release.sh. Keep this private host state file out of Git.
RELEASE_TAG=${release_tag}
BACKEND_IMAGE=${target_backend_image}
FRONTEND_IMAGE=${target_frontend_image}
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
chmod 600 "${state_file_temporary}"
mv -f "${state_file_temporary}" "${deployment_state_file}"

echo "Release ${release_tag} is healthy and recorded for rollback."
