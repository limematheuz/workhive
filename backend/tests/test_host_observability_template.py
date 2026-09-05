from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = ROOT / "ops" / "monitoring" / "workhive-host-observability.yaml"
AGENT_CONFIG_PATH = ROOT / "ops" / "monitoring" / "amazon-cloudwatch-agent.json"


def cloudformation_loader():
    class Loader(yaml.SafeLoader):
        pass

    Loader.add_constructor("!Ref", lambda loader, node: {"Ref": loader.construct_scalar(node)})
    Loader.add_constructor("!Sub", lambda loader, node: {"Sub": loader.construct_scalar(node)})
    return Loader


def test_host_observability_template_is_portable_and_safe():
    template = yaml.load(TEMPLATE_PATH.read_text(encoding="utf-8"), Loader=cloudformation_loader())
    source = TEMPLATE_PATH.read_text(encoding="utf-8")

    assert "175373003951" not in source
    assert "WorkHiveDockerMaintenanceDocument" in template["Resources"]
    association = template["Resources"]["WorkHiveDockerMaintenanceAssociation"]["Properties"]
    assert association["ScheduleExpression"] == "cron(0 5 ? * SUN *)"
    assert association["ApplyOnlyAtCronInterval"] is True
    assert association["MaxConcurrency"] == "1"
    assert association["Targets"][0]["Key"] == "InstanceIds"

    command = template["Resources"]["WorkHiveDockerMaintenanceDocument"]["Properties"]["Content"]["mainSteps"][0]["inputs"]["runCommand"][0]
    assert "docker_maintenance.sh" in command
    assert "volume prune" not in command

    policy = template["Resources"]["WorkHiveHostMetricsPolicy"]["Properties"]["PolicyDocument"]["Statement"][0]
    assert policy["Action"] == "cloudwatch:PutMetricData"
    assert policy["Condition"]["StringEquals"]["cloudwatch:namespace"] == "WorkHive/Host"
    topic = template["Resources"]["WorkHiveDiskAlarmTopic"]["Properties"]
    assert topic["KmsMasterKeyId"] == {"Ref": "WorkHiveDiskAlertsKey"}
    key = template["Resources"]["WorkHiveDiskAlertsKey"]["Properties"]
    assert key["EnableKeyRotation"] is True
    sns_statement = key["KeyPolicy"]["Statement"][1]
    assert sns_statement["Principal"] == {"Service": "sns.amazonaws.com"}
    assert sns_statement["Condition"]["StringEquals"]["aws:SourceAccount"] == {"Ref": "AWS::AccountId"}


def test_cloudwatch_agent_collects_only_root_disk_percentage_with_instance_dimension():
    config = yaml.safe_load(AGENT_CONFIG_PATH.read_text(encoding="utf-8"))

    assert config["metrics"]["namespace"] == "WorkHive/Host"
    assert config["metrics"]["append_dimensions"]["InstanceId"] == "${aws:InstanceId}"
    assert config["metrics"]["aggregation_dimensions"] == [["InstanceId"]]
    assert config["metrics"]["metrics_collected"]["disk"] == {
        "resources": ["/"],
        "measurement": ["used_percent"],
        "drop_device": True,
    }
