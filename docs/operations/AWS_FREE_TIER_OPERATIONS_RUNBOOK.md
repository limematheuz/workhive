# WorkHive AWS operations runbook

## Purpose

This document records the production-safety work completed for WorkHive, why
each control exists, how to reproduce and verify it, and where the next
implementation phase must begin.

It is intentionally safe to keep in Git. It contains variable names and
generic placeholders, but no real credentials, account identifiers, IP
addresses, bucket names, email addresses, SSH key names, tokens, passwords, or
private production values.

Use placeholders such as `<BUCKET_NAME>` only while reading this document.
Real values must live in AWS, the EC2 host environment, or an approved password
manager and must never be committed.

## Outcomes achieved

The following controls are implemented and verified:

- AWS cost budgets and anomaly alerts;
- a manual database and application-data backup;
- checksum and archive validation;
- a real database restore test in an isolated PostgreSQL container;
- a client-side encrypted copy stored outside EC2;
- a private, versioned S3 bucket dedicated to production backups;
- S3 retention rules that control storage growth;
- an EC2 instance role with least-privilege write-only backup access;
- temporary AWS credentials supplied by the EC2 metadata service;
- automated weekly backups managed by `systemd`;
- validation of the uploaded S3 objects;
- local backup cleanup after a short retention period;
- CI coverage for the backup script.

The application image build and deployment pipeline is **not** implemented yet.
GitHub Actions currently validates the application, but EC2 still builds the
backend and frontend images during deployment.

## Why this architecture was chosen

### Backups must leave EC2

A backup stored only on the production server is not sufficient. Disk failure,
accidental deletion, instance loss, filesystem corruption, or a compromised
host could destroy both the application and its backup.

The implemented design keeps:

- short-lived local backup bundles for quick diagnosis;
- remote copies in a private S3 bucket;
- an independently encrypted recovery copy outside AWS for disaster recovery.

### EC2 must not hold permanent AWS access keys

The EC2 instance uses an IAM instance role. AWS supplies short-lived credentials
through the instance metadata service and rotates them automatically. No
`AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` is stored in `.env`, GitHub, shell
history, or the backup configuration.

### The backup role is intentionally write-only

Production EC2 can upload under one S3 prefix but cannot download or delete
backups. If the host is compromised, an attacker cannot use its role to erase
or retrieve the remote recovery data.

Restoration is a separate administrative operation that must use a separately
authorized identity.

### Versioning and lifecycle serve different purposes

S3 Versioning protects against accidental replacement and deletion. Lifecycle
rules prevent old versions and backups from growing forever.

The current retention model is:

- current objects expire after 60 days;
- noncurrent versions are deleted 30 days after becoming noncurrent;
- incomplete multipart uploads are removed after 1 day;
- local EC2 archives are removed after 8 days.

With versioning enabled, expiration of a current object first creates a delete
marker. The old object then becomes noncurrent and is permanently removed by
the noncurrent-version rule.

### Why `ops/` belongs in the repository

`ops/` contains operational code: backup scripts, tests, service definitions,
timers, safe templates, and operating instructions. Keeping this code in Git
provides review, history, reproducibility, and CI testing.

Real configuration does not belong there. For example:

- committed template: `ops/backup/workhive-backup.env.example`;
- real host configuration: `/etc/workhive/backup.env`.

## Security invariants

These rules must remain true:

1. Never commit `.env`, `/etc/workhive/backup.env`, AWS credentials, private
   keys, passwords, real bucket names, account IDs, public IPs, or customer data.
2. Never run `aws configure` on production EC2.
3. Never add `s3:DeleteObject` or broad `s3:*` access to the EC2 backup role.
4. Keep S3 Block Public Access enabled and ACLs disabled.
5. Do not remove S3 versioning or lifecycle retention without a reviewed change.
6. Do not delete Docker volumes as part of backup maintenance.
7. Do not treat a successful upload as a complete backup test; validate formats,
   checksums, and restoration.
8. Do not print environment files or enable shell tracing with `set -x` around
   secret-bearing commands.

## Reference variables

The commands below use shell variables so real infrastructure values do not
need to be copied into documentation:

```bash
export APP_DIR="$HOME/workhive"
export COMPOSE_FILE="$APP_DIR/docker-compose.yml"
export COMPOSE_ENV_FILE="$APP_DIR/.env"
export LOCAL_BACKUP_ROOT="$HOME/workhive-backups"
export AWS_REGION="<AWS_REGION>"
export BACKUP_BUCKET="<BUCKET_NAME>"
export S3_PREFIX="production"
```

Do not save `BACKUP_BUCKET` in shell startup files. The production service reads
it from `/etc/workhive/backup.env`.

## Phase 1: cost controls

### Why

AWS free-plan credits are finite. Budgets do not stop resources automatically,
but they provide early warning before credits are unexpectedly consumed.

### Configuration completed

A monthly cost budget was created with:

- a low actual-cost warning;
- a higher actual-cost warning;
- a forecast warning at the monthly limit;
- an actual-cost warning at the monthly limit.

A daily Cost Anomaly Detection subscription was also created against the
AWS-managed services monitor. It alerts when unexpected spend exceeds a small
absolute threshold.

### Verification

In AWS Billing and Cost Management, verify periodically:

- the budget health is `Healthy`;
- alert recipients are correct;
- the anomaly subscription is active;
- credits remaining and expiration date;
- month-to-date and forecasted spend by service.

Budget alerts are notifications, not hard spending caps. Do not attach an
automatic action that stops production without a separate availability review.

## Phase 2: one-off recovery backup

This phase established that the data could be exported, transferred, validated,
restored, and encrypted before automation was introduced.

### 2.1 Create the backup on EC2

Run from the production application directory. The real Compose environment is
read from `.env`, which must be mode `600` and ignored by Git.

```bash
cd "$APP_DIR"
umask 077

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="$LOCAL_BACKUP_ROOT/$STAMP"
mkdir -p "$BACKUP_DIR"

docker compose \
  -f "$COMPOSE_FILE" \
  --env-file "$COMPOSE_ENV_FILE" \
  exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$BACKUP_DIR/database.dump"

test -s "$BACKUP_DIR/database.dump"

docker compose \
  -f "$COMPOSE_FILE" \
  --env-file "$COMPOSE_ENV_FILE" \
  exec -T backend \
  tar -C /data -czf - . \
  > "$BACKUP_DIR/appdata.tar.gz"

test -s "$BACKUP_DIR/appdata.tar.gz"

cd "$BACKUP_DIR"
sha256sum database.dump appdata.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS

docker compose \
  -f "$COMPOSE_FILE" \
  --env-file "$COMPOSE_ENV_FILE" \
  exec -T db pg_restore --list \
  < database.dump >/dev/null

tar -tzf appdata.tar.gz >/dev/null
```

The application-data archive can be very small when the persistent directories
contain no uploaded media or generated invoices. That is not by itself an
error; the archive listing must still be valid.

### 2.2 Copy the backup to an administrator workstation

Run from the workstation, not from EC2:

```bash
mkdir -p "$HOME/Backups/workhive"
chmod 700 "$HOME/Backups" "$HOME/Backups/workhive"

scp -r \
  <SSH_HOST_ALIAS>:<REMOTE_BACKUP_DIRECTORY> \
  "$HOME/Backups/workhive/"
```

Validate after transfer:

```bash
cd "$HOME/Backups/workhive/<BACKUP_TIMESTAMP>"
shasum -a 256 -c SHA256SUMS
tar -tzf appdata.tar.gz >/dev/null
```

### 2.3 Perform a real isolated restore test

Start a temporary local PostgreSQL container with a randomly generated password:

```bash
RESTORE_CONTAINER="workhive-restore-test-$(date +%s)"
RESTORE_PASSWORD="$(openssl rand -hex 24)"

docker run -d --rm \
  --name "$RESTORE_CONTAINER" \
  -e POSTGRES_USER=restore_test \
  -e POSTGRES_PASSWORD="$RESTORE_PASSWORD" \
  -e POSTGRES_DB=restore_test \
  postgres:16-alpine

until docker exec "$RESTORE_CONTAINER" \
  pg_isready -U restore_test -d restore_test >/dev/null 2>&1
do
  sleep 1
done

docker cp database.dump "$RESTORE_CONTAINER:/tmp/database.dump"

docker exec "$RESTORE_CONTAINER" \
  pg_restore \
  -U restore_test \
  -d restore_test \
  --no-owner \
  --no-privileges \
  /tmp/database.dump
```

Perform structural checks without exposing customer rows:

```bash
docker exec "$RESTORE_CONTAINER" \
  psql -U restore_test -d restore_test -c \
  "SELECT COUNT(*) AS public_tables
   FROM pg_catalog.pg_tables
   WHERE schemaname = 'public';"

docker exec "$RESTORE_CONTAINER" \
  psql -U restore_test -d restore_test -c \
  "SELECT version_num AS alembic_version FROM alembic_version;"

docker exec "$RESTORE_CONTAINER" \
  psql -U restore_test -d restore_test -c \
  "SELECT pg_size_pretty(pg_database_size(current_database())) AS restored_size;"
```

Always remove the temporary database afterward:

```bash
docker stop "$RESTORE_CONTAINER"
unset RESTORE_CONTAINER RESTORE_PASSWORD
docker ps --filter 'name=workhive-restore-test'
```

The final command must show no running restore-test container.

### 2.4 Encrypt the workstation copy

Create one encrypted archive using a strong, unique password generated and
stored in an approved password manager:

```bash
cd "$HOME/Backups/workhive"

tar -czf - <BACKUP_TIMESTAMP> \
  | openssl enc \
      -aes-256-cbc \
      -salt \
      -pbkdf2 \
      -iter 600000 \
      -out <BACKUP_TIMESTAMP>.tar.gz.enc
```

Test decryption before removing plaintext:

```bash
openssl enc \
  -d \
  -aes-256-cbc \
  -pbkdf2 \
  -iter 600000 \
  -in <BACKUP_TIMESTAMP>.tar.gz.enc \
  | tar -tzf - >/dev/null
```

Then protect the encrypted file and delete only the validated plaintext copy:

```bash
chmod 600 <BACKUP_TIMESTAMP>.tar.gz.enc
rm -rf <BACKUP_TIMESTAMP>
```

Losing the encryption password makes this copy unrecoverable. Never reuse a Mac
login password or a production application secret.

## Phase 3: private S3 backup storage

### 3.1 Bucket configuration

Create a general-purpose S3 bucket in the same AWS region as EC2. Configure:

- account-regional or globally unique namespace as available;
- ACLs disabled and bucket-owner enforced;
- Block all public access enabled;
- Versioning enabled;
- default encryption with Amazon S3 managed keys (`SSE-S3`);
- Object Lock disabled for the current cost-conscious design;
- tags such as `Project`, `Environment`, and `Purpose` with generic values.

Do not use the bucket for public files. Do not add a public bucket policy.

### 3.2 Lifecycle configuration

Create a lifecycle rule applying to all objects:

- expire current versions after 60 days;
- permanently delete noncurrent versions after 30 days;
- delete incomplete multipart uploads after 1 day.

Do not enable storage-class transitions without first reviewing minimum storage
durations, retrieval charges, and the expected backup size.

## Phase 4: least-privilege IAM access

### 4.1 Backup write policy

Create a customer-managed IAM policy restricted to the backup bucket and
`production/` prefix. Replace `<BUCKET_NAME>` in the AWS console; never commit
the real value.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadBackupBucketLocation",
      "Effect": "Allow",
      "Action": "s3:GetBucketLocation",
      "Resource": "arn:aws:s3:::<BUCKET_NAME>"
    },
    {
      "Sid": "ListOnlyProductionPrefix",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<BUCKET_NAME>",
      "Condition": {
        "StringLike": {
          "s3:prefix": [
            "production",
            "production/*"
          ]
        }
      }
    },
    {
      "Sid": "UploadOnlyProductionBackups",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::<BUCKET_NAME>/production/*"
    }
  ]
}
```

Do not add `s3:GetObject`, `s3:DeleteObject`, or wildcard access to this role.

### 4.2 EC2 role

Create an IAM role with:

- trusted entity: AWS service;
- use case: EC2;
- trust principal: `ec2.amazonaws.com`;
- only the backup write policy attached.

Attach the role to the production EC2 instance through **Actions → Security →
Modify IAM role**. This does not require restarting the instance.

Verify the instance profile through IMDSv2 without printing credentials:

```bash
TOKEN="$(curl -sS -X PUT \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
  http://169.254.169.254/latest/api/token)"

HTTP_CODE="$(curl -sS \
  -o /dev/null \
  -w '%{http_code}' \
  -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/info)"

printf 'IAM instance profile status: %s\n' "$HTTP_CODE"
unset TOKEN HTTP_CODE
```

Expected status: `200`.

### 4.3 AWS CLI installation

On the current Ubuntu host, AWS CLI v2 was installed from the verified Snap
publisher because the configured APT repositories did not provide `awscli`:

```bash
sudo snap install aws-cli --classic
/snap/bin/aws --version
/snap/bin/aws sts get-caller-identity >/dev/null \
  && echo "Temporary IAM credentials are working"
```

Do not execute `aws configure`.

### 4.4 Permission-boundary tests

Enter the private bucket name without placing it in shell history:

```bash
read -r -p "Private backup bucket: " BACKUP_BUCKET
export AWS_REGION="<AWS_REGION>"
```

Verify allowed operations:

```bash
/snap/bin/aws s3api get-bucket-location \
  --bucket "$BACKUP_BUCKET" \
  --query LocationConstraint \
  --output text

/snap/bin/aws s3api list-objects-v2 \
  --bucket "$BACKUP_BUCKET" \
  --prefix "production/" \
  --max-keys 1 >/dev/null
```

Verify listing the bucket root is denied:

```bash
if /snap/bin/aws s3api list-objects-v2 \
  --bucket "$BACKUP_BUCKET" \
  --max-keys 1 >/dev/null 2>&1
then
  echo "ERROR: bucket root is accessible"
else
  echo "Correct: bucket root access is blocked"
fi
```

Verify upload is allowed without using `/dev/null` as the body:

```bash
TEST_KEY="production/healthchecks/iam-test-$(date -u +%Y%m%dT%H%M%SZ).txt"
TEST_FILE="$(mktemp)"
chmod 600 "$TEST_FILE"
printf 'WorkHive IAM backup upload test\n' > "$TEST_FILE"

/snap/bin/aws s3api put-object \
  --bucket "$BACKUP_BUCKET" \
  --key "$TEST_KEY" \
  --body "$TEST_FILE" \
  --server-side-encryption AES256 >/dev/null

rm -f "$TEST_FILE"
```

Verify deletion is denied:

```bash
if /snap/bin/aws s3api delete-object \
  --bucket "$BACKUP_BUCKET" \
  --key "$TEST_KEY" >/dev/null 2>&1
then
  echo "ERROR: EC2 can delete backups"
else
  echo "Correct: backup deletion is blocked"
fi

unset BACKUP_BUCKET TEST_KEY AWS_REGION
```

The test object is intentionally left for the lifecycle rule to remove.

## Phase 5: automated weekly backups

The implementation lives under `ops/backup/` and is covered by a focused CI
test.

### What the script does

`ops/backup/backup_to_s3.sh`:

1. applies `umask 077`;
2. validates configuration and required commands;
3. acquires a nonblocking host lock to prevent overlapping jobs;
4. creates a custom-format PostgreSQL dump;
5. archives the backend `/data` volume;
6. generates and verifies checksums;
7. validates the dump using `pg_restore --list`;
8. validates the tar archive;
9. creates a single compressed bundle and checksum;
10. uploads both objects with SSE-S3 encryption;
11. confirms exactly two objects exist under the timestamped prefix;
12. removes the temporary directory;
13. deletes only old matching local archives after the configured retention;
14. performs no remote deletion.

### 5.1 Deploy the merged operational code

On EC2:

```bash
cd "$HOME/workhive"
git status -sb
git pull --ff-only origin main
ls -la ops/backup
```

This operational-only change does not require a Docker image rebuild.

### 5.2 Create the private host configuration

```bash
sudo install -d -m 0750 -o root -g ubuntu /etc/workhive

sudo install -m 0640 -o root -g ubuntu \
  ops/backup/workhive-backup.env.example \
  /etc/workhive/backup.env

sudo nano /etc/workhive/backup.env
```

Replace only the bucket placeholder. Do not add AWS access keys. Validate
without printing the file:

```bash
if sudo grep -q 'replace-with-private-backup-bucket-name' \
  /etc/workhive/backup.env
then
  echo "ERROR: bucket placeholder remains"
else
  echo "Backup configuration is prepared"
fi

sudo stat -c '%a %U %G %n' /etc/workhive/backup.env
```

Expected permissions: `640 root ubuntu`.

### 5.3 Install and enable the systemd units

```bash
sudo install -m 0644 \
  ops/backup/workhive-backup.service \
  /etc/systemd/system/workhive-backup.service

sudo install -m 0644 \
  ops/backup/workhive-backup.timer \
  /etc/systemd/system/workhive-backup.timer

sudo systemd-analyze verify \
  /etc/systemd/system/workhive-backup.service \
  /etc/systemd/system/workhive-backup.timer

sudo systemctl daemon-reload
sudo systemctl enable --now workhive-backup.timer
sudo systemctl status workhive-backup.timer --no-pager -l
systemctl list-timers workhive-backup.timer
```

The timer runs every Sunday at 02:30 UTC with a randomized delay of up to 15
minutes. `Persistent=true` causes a missed run to execute after the host starts.

### 5.4 Run the first controlled backup

```bash
sudo systemctl start workhive-backup.service

sudo systemctl show workhive-backup.service \
  --property=Result \
  --property=ExecMainStatus \
  --property=ActiveState \
  --property=SubState

sudo systemctl status workhive-backup.service --no-pager -l
sudo journalctl -u workhive-backup.service -n 100 --no-pager
```

Expected final state:

```text
Result=success
ExecMainStatus=0
ActiveState=inactive
SubState=dead
```

`inactive (dead)` is correct for a oneshot service that finishes. The timer,
not the service process, remains active.

### 5.5 Verify remote and local objects

Use the timestamp reported by the service log:

```bash
BACKUP_TIMESTAMP="<BACKUP_TIMESTAMP>"

sudo bash -c '
set -a
source /etc/workhive/backup.env
set +a

/snap/bin/aws s3api list-objects-v2 \
  --bucket "$BACKUP_BUCKET" \
  --prefix "$S3_PREFIX/'"$BACKUP_TIMESTAMP"'/" \
  --query "Contents[].{File:Key,Size:Size}" \
  --output table \
  --region "$AWS_REGION"
'

sudo ls -lh \
  "$HOME/workhive-backups/workhive-$BACKUP_TIMESTAMP.tar.gz"*

systemctl is-enabled workhive-backup.timer
systemctl is-active workhive-backup.timer
unset BACKUP_TIMESTAMP
```

Expected S3 objects:

- `workhive-backup.tar.gz`;
- `workhive-backup.tar.gz.sha256`.

Expected timer state:

```text
enabled
active
```

## Routine operations

### Check the next run

```bash
systemctl list-timers workhive-backup.timer
```

### Check the last backup

```bash
sudo systemctl status workhive-backup.service --no-pager -l
sudo journalctl -u workhive-backup.service -n 100 --no-pager
```

### Run an additional backup

```bash
sudo systemctl start workhive-backup.service
```

The file lock prevents two backup runs from overlapping.

### Check local backup storage

```bash
sudo du -sh "$HOME/workhive-backups"
sudo find "$HOME/workhive-backups" -maxdepth 1 -type f \
  -name 'workhive-*.tar.gz*' -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' \
  | sort
```

### Check service failures

```bash
sudo systemctl --failed
sudo journalctl -u workhive-backup.service --since '14 days ago' --no-pager
```

Do not paste logs publicly without checking them for infrastructure identifiers.

## Restore runbook boundary

The automated EC2 role cannot download backups by design. A full remote restore
must be performed by an authorized administrator:

1. choose a timestamped S3 backup;
2. download both the archive and checksum using a separate read-authorized
   administrative identity;
3. validate the archive checksum locally;
4. extract into a new isolated directory;
5. validate `SHA256SUMS` inside the bundle;
6. run `pg_restore --list`;
7. restore into a temporary PostgreSQL container;
8. verify table count, Alembic version, and application-data archive;
9. document the recovery result;
10. only then consider a production restore under a separate approved procedure.

Never test restoration directly against the production database.

## Current CI and deployment state

### What GitHub Actions currently does

The workflows under `.github/workflows/` currently run:

- backend tests and migrations against a test PostgreSQL service;
- frontend tests, typecheck, lint, and a validation build;
- React Doctor;
- secret and misconfiguration scanning;
- Python SAST and dependency auditing;
- the focused backup automation test.

The frontend validation build proves that source code compiles, but it is not a
published production Docker image.

### What EC2 still does

Production deployment still uses Compose `build:` entries. Therefore this
command compiles images on EC2:

```bash
docker compose --env-file .env up -d --build
```

The target state is to build once in GitHub Actions, store immutable images in
Amazon ECR, and make EC2 execute only `pull` and `up --no-build`.

## Mandatory handoff instructions for the next AI

The next AI must treat this section as an execution contract.

### Working behavior

1. Speak to the user in Spanish and explain unfamiliar AWS terms in plain
   language before asking the user to configure them.
2. The user performs AWS Console and EC2 actions to learn. Do not operate their
   EC2 or AWS account directly unless they explicitly change that instruction.
3. Give one small, verifiable step at a time. State the expected result before
   continuing.
4. Never ask the user to paste secrets. Warn them to redact account IDs, bucket
   names, public IPs, emails, tokens, and key material from screenshots/output.
5. Never print `.env`, `/etc/workhive/backup.env`, metadata credentials, or
   password-manager values.
6. Before editing the repository, run `git status -sb`, identify the active
   branch, and check whether another AI has concurrent changes.
7. Use a dedicated branch for each phase. Do not merge or deploy without the
   user's explicit approval.
8. Preserve unrelated work and avoid broad refactors.
9. Apply KISS, DRY, SOLID, separation of responsibilities, and the repository
   layering rules pragmatically.
10. Add focused tests before or alongside each behavior change and run all
    affected CI-equivalent checks.
11. Maintain least privilege. Do not introduce static AWS keys when OIDC or an
    instance role can provide temporary credentials.
12. Keep the current deployment path available until the replacement pipeline
    has passed an end-to-end production-safe validation.
13. Do not delete Docker volumes, database data, S3 objects, IAM resources, or
    the previous deployable image during migration.
14. Keep the solution within the user's credit-backed/free-plan objective and
    explain any potentially billable service before enabling it.

### Verified starting state

- Production runs on one EC2 instance with Docker Compose.
- PostgreSQL and persistent application files use Docker volumes.
- Production media storage is still local, not S3-backed.
- The private backup S3 bucket, versioning, encryption, lifecycle, IAM role,
  AWS CLI, weekly systemd timer, and first automated backup are complete.
- The EC2 backup role can list only `production/`, upload there, and cannot list
  the root or delete objects.
- GitHub Actions validates code and security but does not publish images.
- EC2 still builds backend and frontend images locally.

### Required next phases and exact order

#### Phase A: application versioning

1. Audit existing package versions, health endpoints, UI settings/about areas,
   Dockerfiles, and Compose variables.
2. Propose one source of truth using semantic versions (`MAJOR.MINOR.PATCH`) and
   immutable Git commit SHA metadata.
3. Define release rules:
   - incompatible change: major;
   - backward-compatible feature: minor;
   - backward-compatible fix: patch.
4. Add version metadata to backend health/build information without exposing
   secrets or internal infrastructure.
5. Expose a concise version in an appropriate frontend About/Settings or footer
   location, not across every screen.
6. Add backend and frontend tests for version propagation and fallback behavior.
7. Run backend tests; frontend tests, typecheck, lint, and build; React Doctor;
   and security workflows.
8. Create a PR and stop for user approval.

Do not create automatic version bumps on every commit. A release version should
represent a reviewed release; the commit SHA distinguishes individual builds.

#### Phase B: private ECR repositories

1. Reconfirm AWS credits and current month forecast before creation.
2. Explain that ECR is a private Docker image registry.
3. Create separate private repositories for backend and frontend.
4. Enable image scanning where supported and use immutable release/SHA tags.
5. Add lifecycle policies that retain enough images for rollback while removing
   old untagged images.
6. Record repository names only in private deployment configuration or GitHub
   variables, not as sensitive production identifiers in public documentation.

Do not switch Compose to ECR yet.

#### Phase C: GitHub-to-AWS OIDC

1. Explain OIDC as short-lived authentication without saved AWS access keys.
2. Configure the GitHub OIDC provider in AWS if it does not already exist.
3. Create a dedicated GitHub Actions role restricted to the exact repository,
   main branch or protected production environment, and required audience.
4. Grant only ECR authentication and push permissions to the two repositories.
5. Do not reuse the EC2 backup role.
6. Store non-secret values such as AWS region, role ARN, and repository names as
   GitHub environment/repository variables. Store no static AWS keys.
7. Add a read-only authentication test before adding image publication.

#### Phase D: reproducible image build and publication

1. Pin GitHub Actions by reviewed versions or commit SHAs.
2. Run all existing tests and security checks before publishing.
3. Build backend and frontend images with Docker Buildx.
4. Tag every image with the full or safely shortened Git SHA; add a semantic
   version tag only for a release.
5. Push both images to ECR only after checks pass.
6. Produce build provenance/SBOM if practical without exceeding the current
   cost and complexity constraints.
7. Never publish `latest` as the only deployable reference.
8. Test pulling the exact immutable image tags from EC2.

#### Phase E: production Compose without builds

1. Create a production Compose override or equivalent that replaces backend and
   frontend `build:` with explicit ECR `image:` references.
2. Keep local development Compose behavior unchanged.
3. Add a private deployment variable such as `APP_IMAGE_TAG=<GIT_SHA>`.
4. Authenticate EC2 to ECR using its instance role; do not use a saved Docker
   password or static AWS keys.
5. Extend the EC2 role with only the minimum ECR pull permissions. Keep backup
   write permissions logically documented and independently reviewable.
6. Validate rendered Compose configuration before changing containers.

#### Phase F: safe deployment and rollback

1. Create a small deployment script under `ops/deploy/` with a lock, strict
   error handling, configuration validation, ECR login, image pull, Compose
   update, and health checks.
2. Record the previously deployed immutable image tag before changing anything.
3. Deploy using `docker compose pull` and `docker compose up -d --no-build`.
4. Check backend health, frontend login, container health, and migration state.
5. On failure, restore the previous image tag and restart without rebuilding.
6. Do not automate database downgrade. Database migration rollback requires a
   separately reviewed strategy and a fresh verified backup.
7. Initially keep the final production trigger manual and user-controlled.
8. Only after repeated successful deployments consider GitHub-triggered AWS SSM
   execution with a protected GitHub production environment and approval gate.

Avoid exposing SSH to GitHub-hosted runners and avoid storing an SSH private key
as a repository secret when AWS SSM can provide controlled execution later.

#### Phase G: pilot monitoring

1. Measure deployment duration, EC2 CPU, memory, swap, disk, Docker cache, and
   application health before and after the new pipeline.
2. Verify that EC2 no longer builds application images.
3. Confirm ECR lifecycle retention still permits rollback.
4. Confirm weekly backups continue after deployment changes.
5. Review AWS costs and credits after the first complete billing day.
6. Document the final release and disaster-recovery procedure.

### Definition of done for the future deployment pipeline

The migration is not complete until all of the following are true:

- every production image has an immutable SHA tag;
- semantic version and commit SHA are visible in controlled build metadata;
- GitHub uses OIDC and no static AWS key;
- EC2 pulls from ECR using its instance role;
- production Compose contains no active backend/frontend build step;
- all CI and security checks pass before publication;
- a failed health check can restore the previous image tags;
- backups are run and verified before migration-sensitive deployments;
- the user has performed and understood one complete deployment;
- cost and retention controls are documented and verified.

## Status checklist

- [x] Cost budgets configured.
- [x] Cost anomaly subscription configured.
- [x] Manual database and app-data backup created.
- [x] Checksums and archive formats validated.
- [x] Isolated PostgreSQL restore tested.
- [x] Independent encrypted recovery copy created.
- [x] Private S3 backup bucket created.
- [x] Public access blocked and ACLs disabled.
- [x] S3 Versioning and SSE-S3 enabled.
- [x] S3 lifecycle retention configured.
- [x] Least-privilege EC2 backup role attached.
- [x] Allowed and denied IAM operations tested.
- [x] Weekly automated backup timer installed.
- [x] First automated S3 backup completed and verified.
- [ ] Application semantic versioning and SHA metadata.
- [ ] Private backend/frontend ECR repositories.
- [ ] GitHub Actions OIDC role.
- [ ] Reproducible image build and publication workflow.
- [ ] Production Compose using immutable ECR images.
- [ ] Health-checked deployment and rollback script.
- [ ] Pilot monitoring and final operations review.
