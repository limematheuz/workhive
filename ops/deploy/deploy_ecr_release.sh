#!/usr/bin/env bash
set -euo pipefail

# Deploy one immutable ECR image revision to production. A formal release uses
# an annotated vMAJOR.MINOR.PATCH tag; the continuous main workflow uses the
# complete 40-character Git SHA. The script is intentionally host-oriented:
# its real configuration and state live outside Git in /etc/workhive and it
# never needs persistent AWS keys.

umask 077

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this deployment command with sudo." >&2
    exit 1
fi

if [[ "${#}" -ne 1 || ! "${1}" =~ ^(v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)|[0-9a-f]{40})$ ]]; then
    echo "Usage: sudo $0 vMAJOR.MINOR.PATCH|FULL_GIT_SHA" >&2
    exit 1
fi

release_ref="${1}"
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
git_bin="${GIT_BIN:-git}"
runuser_bin="${RUNUSER_BIN:-runuser}"
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
    "${git_bin}" \
    "${runuser_bin}" \
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

source_checkout_changed=false
deployment_succeeded=false
previous_source_commit=""
workhive_owner="$(stat -c '%U' "${workhive_dir}")"
workhive_owner_home="$(getent passwd "${workhive_owner}" | cut -d: -f6)"
if [[ -z "${workhive_owner_home}" || ! -d "${workhive_owner_home}" ]]; then
    echo "Could not resolve the home directory for ${workhive_owner}." >&2
    exit 1
fi
git_command=(
    "${runuser_bin}" -u "${workhive_owner}" --
    env HOME="${workhive_owner_home}"
    "${git_bin}" -C "${workhive_dir}"
)

restore_source_checkout() {
    if [[ "${source_checkout_changed}" != "true" || -z "${previous_source_commit}" ]]; then
        return 0
    fi

    echo "Restoring the previous production source checkout." >&2
    "${git_command[@]}" checkout --detach "${previous_source_commit}" >/dev/null
    source_checkout_changed=false
}

sync_release_checkout() {
    local release_commit

    if [[ ! -d "${workhive_dir}/.git" ]]; then
        echo "Production source checkout is not a Git worktree: ${workhive_dir}" >&2
        return 1
    fi
    if [[ -n "$("${git_command[@]}" status --porcelain --untracked-files=no)" ]]; then
        echo "Production source checkout has tracked changes; refusing to overwrite them." >&2
        return 1
    fi

    previous_source_commit="$("${git_command[@]}" rev-parse HEAD)"
    "${git_command[@]}" fetch --force origin \
        "refs/heads/main:refs/remotes/origin/main"

    if [[ "${release_ref}" =~ ^v ]]; then
        "${git_command[@]}" fetch --force origin \
            "refs/tags/${release_ref}:refs/tags/${release_ref}"
        if [[ "$("${git_command[@]}" cat-file -t "refs/tags/${release_ref}")" != "tag" ]]; then
            echo "Release source must use an annotated Git tag: ${release_ref}" >&2
            return 1
        fi
        release_commit="$("${git_command[@]}" rev-list -n 1 "refs/tags/${release_ref}")"
    else
        if ! "${git_command[@]}" cat-file -e "${release_ref}^{commit}"; then
            echo "Release SHA is not available from origin/main: ${release_ref}" >&2
            return 1
        fi
        release_commit="$("${git_command[@]}" rev-parse "${release_ref}^{commit}")"
    fi

    if ! "${git_command[@]}" merge-base --is-ancestor \
        "${release_commit}" refs/remotes/origin/main; then
        echo "Release source must belong to origin/main: ${release_ref}" >&2
        return 1
    fi

    "${git_command[@]}" checkout --detach "${release_commit}" >/dev/null
    source_checkout_changed=true
}

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
    local exit_code="$?"

    rm -rf -- "${docker_config_directory}"
    if [[ "${exit_code}" -ne 0 && "${deployment_succeeded}" != "true" ]]; then
        restore_source_checkout || true
    fi
    trap - EXIT
    exit "${exit_code}"
}
trap cleanup EXIT
export DOCKER_CONFIG="${docker_config_directory}"

account_id="$("${aws_bin}" sts get-caller-identity --query Account --output text --region "${aws_region}")"
if [[ ! "${account_id}" =~ ^[0-9]{12}$ ]]; then
    echo "Could not resolve the AWS account for the EC2 instance role." >&2
    exit 1
fi
registry="${account_id}.dkr.ecr.${aws_region}.amazonaws.com"
target_backend_image="${registry}/workhive/backend:${release_ref}"
target_frontend_image="${registry}/workhive/frontend:${release_ref}"

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
            --image-ids "imageTag=${release_ref}" \
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

echo "Synchronizing production runtime configuration to ${release_ref}."
sync_release_checkout

for required_file in \
    "${workhive_dir}/Caddyfile" \
    "${workhive_dir}/docker-compose.yml" \
    "${workhive_dir}/docker-compose.production.yml"; do
    if [[ ! -f "${required_file}" ]]; then
        echo "Required release file not found: ${required_file}" >&2
        exit 1
    fi
done

echo "Validating production Compose configuration."
BACKEND_IMAGE="${target_backend_image}" FRONTEND_IMAGE="${target_frontend_image}" \
    "${compose_production[@]}" config >/dev/null

echo "Pulling release ${release_ref} from ECR."
BACKEND_IMAGE="${target_backend_image}" FRONTEND_IMAGE="${target_frontend_image}" \
    "${compose_production[@]}" pull backend frontend

echo "Starting release ${release_ref} without building on EC2."
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
RELEASE_REF=${release_ref}
BACKEND_IMAGE=${target_backend_image}
FRONTEND_IMAGE=${target_frontend_image}
DEPLOYED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
chmod 600 "${state_file_temporary}"
mv -f "${state_file_temporary}" "${deployment_state_file}"
deployment_succeeded=true

echo "Release ${release_ref} is healthy and recorded for rollback."
