# WorkHive production backups

This module creates a consistent PostgreSQL dump, archives the persistent
`/data` volume, validates both outputs, and uploads the resulting bundle to a
private S3 prefix. It uses the EC2 instance role; AWS access keys must never be
added to the environment file.

## Safety properties

- exits before upload when the database dump or data archive is invalid;
- prevents overlapping executions with a host lock;
- uploads with S3-managed AES-256 encryption;
- verifies that both remote objects are visible after upload;
- retains failed local backups for investigation;
- removes only matching local archives after the configured retention period;
- relies on S3 Lifecycle for remote retention and has no remote delete action.

## Host installation

Run these commands on the production EC2 host after deploying the repository:

```bash
sudo install -d -m 0750 -o root -g ubuntu /etc/workhive
sudo install -m 0640 -o root -g ubuntu \
  ops/backup/workhive-backup.env.example \
  /etc/workhive/backup.env
sudo install -m 0644 ops/backup/workhive-backup.service \
  /etc/systemd/system/workhive-backup.service
sudo install -m 0644 ops/backup/workhive-backup.timer \
  /etc/systemd/system/workhive-backup.timer
```

Edit `/etc/workhive/backup.env` and replace only the bucket placeholder with
the private production backup bucket name. The other defaults match the
single-EC2 Docker Compose deployment.

Validate and start the timer:

```bash
sudo systemd-analyze verify \
  /etc/systemd/system/workhive-backup.service \
  /etc/systemd/system/workhive-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now workhive-backup.timer
systemctl list-timers workhive-backup.timer
```

The timer runs every Sunday at 02:30 UTC with a randomized delay of up to 15
minutes. `Persistent=true` runs a missed backup after the host starts again.

## Manual verification

Run one backup before relying on the timer:

```bash
sudo systemctl start workhive-backup.service
sudo systemctl status workhive-backup.service --no-pager
sudo journalctl -u workhive-backup.service -n 100 --no-pager
```

The service must finish with `status=0/SUCCESS` and log a remote prefix without
printing credentials or application environment values.

## Restore boundary

The EC2 role intentionally cannot read or delete remote backups. Recovery is
an administrative operation: download the selected archive with an authorized
administrator identity, validate its `.sha256` file, extract it in an isolated
directory, and restore the database into a temporary PostgreSQL instance before
touching production.
