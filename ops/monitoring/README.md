# WorkHive host observability

This module creates the minimum host signal needed to avoid another failed
release pull: root-disk usage and a notification at 80%. It collects no
application logs, customer data or environment-file content.

## One-account deployment

The portable CloudFormation template creates a private SSM maintenance
document, its weekly association, an SNS topic, a disk alarm and the smallest
instance-role policy for publishing the metric. Review a change set before
executing it:

```bash
aws cloudformation deploy \
  --region "<AWS_REGION>" \
  --stack-name workhive-host-observability \
  --template-file ops/monitoring/workhive-host-observability.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    ProductionInstanceId="<EC2_INSTANCE_ID>" \
    ProductionInstanceRoleName="<EC2_INSTANCE_ROLE_NAME>" \
    NotificationEmail="<ALERT_RECIPIENT_EMAIL>"
```

Confirm the SNS subscription email before treating the alarm as operational.
The template targets exactly the supplied instance; it does not target an
entire account or tag group.

## CloudWatch agent

Install **AmazonCloudWatchAgent** on the target managed instance using Systems
Manager's `AWS-ConfigureAWSPackage` document. Then, on the host, install the
versioned configuration and start it:

```bash
sudo install -d -m 0755 /opt/aws/amazon-cloudwatch-agent/etc
sudo install -m 0644 ops/monitoring/amazon-cloudwatch-agent.json \
  /opt/aws/amazon-cloudwatch-agent/etc/workhive-host-metrics.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/workhive-host-metrics.json
```

Check that the `WorkHive/Host` namespace emits `disk_used_percent` for the
instance, then test the SNS confirmation path. The alarm treats missing
metrics as breaching: an unavailable agent is actionable, not invisible.

## Cost boundary

The configuration emits one root-disk metric every minute. Review CloudWatch
custom-metric and SNS pricing in the target AWS region before enabling it;
never assume a free-tier allowance survives an account migration.
