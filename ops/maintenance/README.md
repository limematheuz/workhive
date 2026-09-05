# WorkHive host maintenance

This module prevents unused Docker build cache, images and stopped containers
from exhausting the EC2 root volume. It never prunes Docker volumes, running
containers, application data, backups or release images referenced by a
running service.

## Host timer

Install after a reviewed repository deployment on EC2:

```bash
sudo install -m 0755 ops/maintenance/docker_maintenance.sh \
  /home/ubuntu/workhive/ops/maintenance/docker_maintenance.sh
sudo install -m 0644 ops/maintenance/workhive-docker-maintenance.service \
  /etc/systemd/system/workhive-docker-maintenance.service
sudo install -m 0644 ops/maintenance/workhive-docker-maintenance.timer \
  /etc/systemd/system/workhive-docker-maintenance.timer
sudo systemd-analyze verify /etc/systemd/system/workhive-docker-maintenance.service \
  /etc/systemd/system/workhive-docker-maintenance.timer
sudo systemctl daemon-reload
sudo systemctl enable --now workhive-docker-maintenance.timer
```

The timer runs every Sunday at 05:00 UTC, after the weekly backup window. Run
and inspect it once before relying on it:

```bash
sudo systemctl start workhive-docker-maintenance.service
sudo journalctl -u workhive-docker-maintenance.service -n 100 --no-pager
```

## AWS State Manager

For a future account, use the private command document
`workhive-docker-maintenance.ssm.yaml` with a weekly State Manager association.
Target the explicit production instance, use `cron(0 5 ? * SUN *)`, enable
**Apply association only at the next specified Cron interval**, and set maximum
concurrency to one. Do not use `AWS-RunShellScript` or target every instance.
