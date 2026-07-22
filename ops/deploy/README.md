# WorkHive ECR deployment

This directory defines the **manual** production deployment path after a release
image has passed CI and been published to private Amazon ECR. EC2 pulls an
immutable image; it never builds backend or frontend application images.

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

## Deploy a reviewed release

First ensure the release workflow completed successfully and ECR Basic scanning
shows a completed scan for both images. Then run exactly one command:

```bash
cd "$HOME/workhive"
sudo ops/deploy/deploy_ecr_release.sh vMAJOR.MINOR.PATCH
```

The release tag must already exist in ECR. The script checks the backup result,
pulls that exact backend/frontend image pair, waits for containers to become
healthy without a build, then checks backend health, login, running containers,
and Alembic state. On success, the current release is recorded in
`/etc/workhive/deployed-release.env`.

## Deploy from GitHub Actions through SSM

The preferred production path is the manual `Deploy reviewed release to
production` GitHub Actions workflow. It never opens SSH from GitHub and it
does not contain AWS access keys.

The workflow can only be dispatched from `main` with a strict
`vMAJOR.MINOR.PATCH` release tag. It assumes a dedicated GitHub OIDC role,
requests the private `WorkHiveProductionDeploy` SSM Command document for the
one configured production instance, and waits for the result. The SSM document
starts this same host script, so backup validation, immutable image checks,
health checks, and rollback behavior remain in one place.

Before enabling the workflow, configure outside Git:

- the EC2 instance role with Systems Manager managed-instance access;
- the private SSM document named `WorkHiveProductionDeploy`;
- a dedicated GitHub OIDC deployment role that can only invoke that document
  for the production EC2 instance and read the invocation result;
- the GitHub repository variables `AWS_DEPLOY_ROLE_ARN` and
  `PRODUCTION_EC2_INSTANCE_ID`.

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
sudo grep -E '^(RELEASE_TAG|DEPLOYED_AT)=' /etc/workhive/deployed-release.env
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
fresh backup, image validation, health checks, and rollback paths. CI executes
it before the backend test suite.
