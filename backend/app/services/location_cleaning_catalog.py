"""Reusable cleaning templates. The catalog is content, not customer data."""

import json
from pathlib import Path

from app.schemas.location_workspace import LocationCatalogSpaceSuggestion, LocationSpaceTaskTemplateInput

_SOURCE = Path(__file__).resolve().parents[1] / "data" / "location-cleaning-catalog.json"
_CATALOG = json.loads(_SOURCE.read_text(encoding="utf-8"))
TEMPLATES = {item["id"]: item for item in _CATALOG["space_templates"]}
SITE_DEFINITIONS = _CATALOG["site_types"]


def catalog_site_types():
    result = []
    for site in SITE_DEFINITIONS:
        templates = [
            {**TEMPLATES[key], "label": site["template_labels"][key]}
            for key in site["templates"]
        ]
        result.append({
            "id": site["id"], "label": site["label"],
            "description": site["description"], "guidance": site["guidance"],
            "space_templates": templates,
            "attributes": [
                {"id": template["count_key"], "label": template["label"], "kind": "number"}
                for template in templates
            ] + [
                {"id": "floor_count", "label": "Plantas", "kind": "number"},
                {"id": "surface_m2", "label": "Superficie aproximada (m²)", "kind": "number"},
                {"id": "has_exterior", "label": "Tiene zonas exteriores", "kind": "boolean"},
            ],
        })
    return result


def selected_count(attributes, template):
    key = template["count_key"]
    if key in attributes:
        value = attributes[key]
        return min(value, 100) if isinstance(value, int) and not isinstance(value, bool) and value > 0 else 0
    # Older profiles keep their original boolean fields until deliberately edited.
    alias = {"office_kitchen": "has_kitchen", "kitchen": "has_kitchen", "reception": "has_reception", "living_room": "has_living_room", "entrance": "has_common_areas"}.get(template["id"])
    return 1 if alias and attributes.get(alias) is True else 0


def template_tasks(template, attributes):
    titles = list(template["tasks"])
    for feature in template["features"]:
        key = f"feature_{template['id'][:24]}_{feature['id'][:40]}"
        if attributes.get(key) is True:
            titles.extend(feature["tasks"])
    seen = set()
    tasks = []
    for title in titles:
        key = title.strip().rstrip(".").casefold()
        if key not in seen:
            seen.add(key)
            tasks.append(LocationSpaceTaskTemplateInput(title=title, category="cleaning"))
    return tasks


def generate_spaces(site_type, attributes):
    site = next(item for item in SITE_DEFINITIONS if item["id"] == site_type)
    spaces = []
    for key in site["templates"]:
        template = TEMPLATES[key]
        for index in range(selected_count(attributes, template)):
            spaces.append(LocationCatalogSpaceSuggestion(
                name=f"{template['name']} {index + 1}",
                space_type=template["space_type"],
                attributes={"catalog_template": key},
                tasks=template_tasks(template, attributes),
            ))
            if len(spaces) >= 200:
                return spaces
    return spaces
