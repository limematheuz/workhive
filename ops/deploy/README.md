# WorkHive ECR deployment

This directory defines the production deployment path after a commit has passed
CI and its images have been published to private Amazon ECR. Every merge to
`main` follows that path automatically and pauses for the GitHub `production`
environment approval. EC2 pulls an immutable image; it never builds backend or
frontend application images.

The broader explanation of the release lifecycle and its AWS/GitHub terms is
in [the production delivery guide](../../docs/operations/PRODUCTION_DELIVERY_GUIDE.md).

## Security boundaries

- The EC2 instance role supplies short-lived AWS credentials. Do not run
  `aws configure` and do not add AWS keys to any environment file.
- `/etc/workhive/deploy.env` and `/etc/workhive/deployed-release.env` stay on
  EC2 with restrictive permissions and are ignored by Git.
- The deployment acquires a lock, starts the verified backup service first,
  validates both release images, and uses a temporary Docker login directory.
- A deployment uses `--no-build` only. If validation fails, it restores the
  previous recorded immutable ECR images. The very first ECR deployment falls
  back to the locally retained application images instead.
- Database migrations run only forwards. Recovery that requires a database
  downgrade needs its own reviewed recovery procedure.

## One-time EC2 setup

After this change is reviewed and merged, on EC2:

```bash
cd "$HOME/workhive"
git pull --ff-only origin main

sudo install -d -m 0750 -o root -g ubuntu /etc/workhive
sudo install -m 0640 -o root -g ubuntu \
  ops/deploy/workhive-deploy.env.example \
  /etc/workhive/deploy.env
sudo nano /etc/workhive/deploy.env
```

Keep the generic defaults, confirm the real WorkHive directory and Compose
environment path, and use the AWS region that contains ECR. The bucket name,
AWS account number, database password, and AWS access keys do **not** belong in
this file.

Check the private file without printing its content:

```bash
sudo stat -c '%a %U %G %n' /etc/workhive/deploy.env
```

Expected permissions are `640 root ubuntu`.

## Deploy a reviewed revision manually

First ensure the release workflow completed successfully and ECR Basic scanning
shows a completed scan for both images. Then run exactly one command:

```bash
cd "$HOME/workhive"
sudo ops/deploy/deploy_ecr_release.sh FULL_GIT_SHA
```

The full Git SHA must already exist as the immutable tag of both ECR images and
belong to `origin/main`. An annotated `vMAJOR.MINOR.PATCH` tag remains accepted
for a formal release or rollback. The script checks the backup result, refuses
tracked host changes, synchronizes the production checkout to that exact commit,
pulls the matching
backend/frontend image pair, waits for containers to become healthy without a
build, then checks backend health, login, running containers, and Alembic state.
On success, the current release is recorded in
`/etc/workhive/deployed-release.env`.

## Deploy from GitHub Actions through SSM

The preferred production path is `Deploy main to production`, triggered only
by a push to `main` (normally a merged PR). It waits for the named CI and
security checks for that exact commit, publishes backend and frontend images
tagged with its full SHA, then pauses at the GitHub `production` environment.
After an approved deployment, it invokes SSM. It never opens SSH from GitHub
and it does not contain AWS access keys.

The older manual `Deploy reviewed release to production` workflow is retained
for a deliberate rollback or a formal semantic release. Both workflows accept
an immutable full SHA; the manual one also accepts an annotated semantic tag.
They assume a dedicated GitHub OIDC role, request the private
`WorkHiveProductionDeploy` SSM Command document for the one configured
production instance, and wait for the result. The SSM document starts this same
host script, so backup validation, immutable image checks, health checks, and
rollback behavior remain in one place.

Before enabling the workflow, configure outside Git:

- the EC2 instance role with Systems Manager managed-instance access;
- the private SSM document named `WorkHiveProductionDeploy`;
- a dedicated GitHub OIDC deployment role that can only invoke that document
  for the production EC2 instance and read the invocation result;
- the GitHub repository variables `AWS_DEPLOY_ROLE_ARN` and
  `PRODUCTION_EC2_INSTANCE_ID`.
- a GitHub `production` environment with required reviewers. Configure this in
  **Settings → Environments → production**; without required reviewers GitHub
  will not pause the automatic deployment.

Protect `main` outside GitHub Actions too: require pull requests and the named
CI/security checks, and disallow direct pushes. Otherwise a direct push would
correctly be treated as a production candidate by the workflow.

The canonical content for the private SSM document is
[`workhive-production-deploy.ssm.yaml`](workhive-production-deploy.ssm.yaml).
When changing it in AWS, use **Actions → Create new version**, paste that
file's content, and then set the new document version as default. Do not use
**Clone document**: the GitHub workflow is intentionally limited to the
existing `WorkHiveProductionDeploy` document.

To deploy, open **GitHub → Actions → Deploy reviewed release to production →
Run workflow**, keep branch `main`, and enter an image tag that already passed
the release-publication workflow, such as `v1.2.3`. Review the workflow result
and the SSM command details; do not treat dispatching the workflow as a
successful deployment until its final status is successful.

## Verify and rollback

After a successful deploy:

```bash
docker compose --env-file .env ps
sudo grep -E '^(RELEASE_REF|DEPLOYED_AT)=' /etc/workhive/deployed-release.env
```

Only use the second command on EC2; the file also contains private image
registry references, so the command deliberately prints only the version and
deployment time. The script automatically rolls back if its validation fails.
For a deliberate rollback, run the script again with an older release tag that
still exists in ECR. Never delete the preceding release before a successful
deploy.

## Test coverage

`test_deploy_ecr_release.sh` validates the shell syntax and the security
contract: no EC2 application build, no static AWS keys, temporary ECR login,
fresh backup, annotated-tag source synchronization, image validation, health
checks, and rollback paths. CI executes it before the backend test suite.
