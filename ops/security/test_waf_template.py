import json
from pathlib import Path


template_path = Path(__file__).with_name("workhive-edge-waf.json")
template = json.loads(template_path.read_text(encoding="utf-8"))


def _rate_rule(name: str) -> dict:
    return next(
        rule
        for rule in template["Resources"]["WorkHiveWebAcl"]["Properties"]["Rules"]
        if rule["Name"] == name
    )


web_acl = template["Resources"]["WorkHiveWebAcl"]["Properties"]
assert web_acl["Scope"] == "REGIONAL"
assert template["Resources"]["WebAclAssociation"]["Properties"]["ResourceArn"] == {
    "Ref": "ApplicationLoadBalancerArn"
}

managed_group_names = {
    rule["Statement"]["ManagedRuleGroupStatement"]["Name"]
    for rule in web_acl["Rules"]
    if "ManagedRuleGroupStatement" in rule["Statement"]
}
assert {
    "AWSManagedRulesAmazonIpReputationList",
    "AWSManagedRulesCommonRuleSet",
    "AWSManagedRulesKnownBadInputsRuleSet",
    "AWSManagedRulesSQLiRuleSet",
}.issubset(managed_group_names)

core_rule = next(
    rule
    for rule in web_acl["Rules"]
    if rule["Name"] == "AWS-Core-Rule-Set"
)
assert core_rule["Statement"]["ManagedRuleGroupStatement"]["RuleActionOverrides"] == [
    {"Name": "SizeRestrictions_BODY", "ActionToUse": {"Count": {}}}
]

for rule_name in ("Public-Write-Rate-Limit", "API-Rate-Limit", "Site-Rate-Limit"):
    rule = _rate_rule(rule_name)
    rate_statement = rule["Statement"]["RateBasedStatement"]
    assert rate_statement["AggregateKeyType"] == "IP"
    assert rate_statement["EvaluationWindowSec"] == 60
    assert rule["Action"]["Block"]["CustomResponse"]["ResponseCode"] == 429

print("AWS WAF edge template contract passed")
