import pytest

from app.services.location_cleaning_catalog import (
    SITE_DEFINITIONS, TEMPLATES, catalog_site_types, generate_spaces,
    selected_count, template_tasks,
)


def test_catalog_contains_all_site_types_and_resolvable_space_templates():
    sites = catalog_site_types()
    assert len(sites) == 20
    assert len({site["id"] for site in sites}) == 20
    for site in sites:
        assert site["space_templates"]
        assert all(template["id"] in TEMPLATES for template in site["space_templates"])


@pytest.mark.parametrize("value, expected", [(0, 0), (-1, 0), (True, 0), ("2", 0), (2, 2), (1000, 100)])
def test_characteristic_counts_are_explicit_bounded_integers(value, expected):
    template = TEMPLATES["office_kitchen"]
    assert selected_count({template["count_key"]: value, "has_kitchen": True}, template) == expected


def test_legacy_boolean_can_generate_a_space_until_count_is_explicitly_zero():
    template = TEMPLATES["office_kitchen"]
    assert selected_count({"has_kitchen": True}, template) == 1
    assert selected_count({"has_kitchen": True, template["count_key"]: 0}, template) == 0


def test_optional_characteristics_add_only_their_related_tasks_without_duplicates():
    template = next(template for template in TEMPLATES.values() if template["features"])
    feature = template["features"][0]
    feature_key = f"feature_{template['id'][:24]}_{feature['id'][:40]}"
    normal = template_tasks(template, {})
    enhanced = template_tasks(template, {feature_key: True})
    assert {task.title for task in normal}.issubset({task.title for task in enhanced})
    assert set(feature["tasks"]).issubset({task.title for task in enhanced})
    assert len(enhanced) == len({task.title.strip().rstrip(".").casefold() for task in enhanced})
    assert all(task.estimated_minutes is None for task in enhanced)


def test_each_configured_unit_generates_a_space_with_its_own_task_list():
    spaces = generate_spaces("office", {"office_count": 2, "bathroom_count": 1})
    assert len(spaces) == 3
    assert spaces[0].space_type == "office"
    assert spaces[-1].space_type == "bathroom"
    assert spaces[0].tasks and spaces[-1].tasks
    assert spaces[0].tasks != spaces[-1].tasks


def test_generation_respects_the_overall_space_limit():
    site = SITE_DEFINITIONS[0]
    counts = {TEMPLATES[key]["count_key"]: 100 for key in site["templates"]}
    assert len(generate_spaces(site["id"], counts)) == 200
