# WorkHive release versioning

WorkHive identifies a production release with two complementary values:

- `APP_VERSION`: the reviewed semantic version, such as `1.1.0`;
- `GIT_SHA`: the immutable Git commit used to build the images.

`VERSION` at the repository root is the release-version source of truth. The
frontend package version and backend default must match it; CI tests reject
drift between those files.

## Semantic version rules

WorkHive follows `MAJOR.MINOR.PATCH`:

- increment `MAJOR` for an incompatible API or workflow change;
- increment `MINOR` for a backward-compatible feature;
- increment `PATCH` for a backward-compatible correction.

Do not increment the release version for every commit. The SHA distinguishes
builds made between reviewed releases.

## Build metadata

Build systems must read the version and revision without editing source files:

```bash
APP_VERSION="$(tr -d '[:space:]' < VERSION)"
GIT_SHA="$(git rev-parse HEAD)"
```

They are passed as Docker build arguments:

```bash
APP_VERSION="$APP_VERSION" \
GIT_SHA="$GIT_SHA" \
docker compose --env-file .env build backend frontend
```

The backend publishes sanitized metadata at `/health`. The frontend displays a
compact label at the bottom of the expanded sidebar. Only a valid semantic
version and the first 12 hexadecimal SHA characters are exposed; malformed
values become safe development or `unknown` fallbacks.

## Preparing a release

1. Choose the required SemVer increment.
2. Update `VERSION`, `frontend/package.json`, the backend `APP_VERSION` default,
   and Docker/Compose version defaults in one focused change.
3. Run backend and frontend tests, typecheck, lint, build, React Doctor, and
   security checks.
4. Merge the reviewed release PR.
5. Create an annotated Git tag matching the version, for example `v1.2.0`.
6. Build images from that exact tag and inject its full Git SHA.
7. Keep the previous immutable image tags available for rollback.

The future ECR workflow must automate steps 5-7 without storing static AWS
credentials. It must use GitHub OIDC and publish SHA-tagged images.
