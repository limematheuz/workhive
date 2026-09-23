import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    getLocationZoneTypeLabel,
    LOCATION_ZONE_TYPE_OPTIONS,
} from "../domain/locations/location-zone.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("location zones keep a small reusable set of operational types", () => {
    assert.deepEqual(LOCATION_ZONE_TYPE_OPTIONS, [
        "bathroom",
        "office",
        "kitchen",
        "common_area",
        "exterior",
        "other",
    ]);
    assert.equal(getLocationZoneTypeLabel("bathroom"), "Baño");
    assert.equal(getLocationZoneTypeLabel("unknown"), "Otra zona");
});

test("spaces are optional in configuration and task creation", () => {
    const spacesTab = read("../components/locations/LocationSpacesTab.tsx");
    const taskZones = read("../components/tasks/TaskCreateZonesSection.tsx");

    assert.match(spacesTab, /Espacios y tareas/);
    assert.match(spacesTab, /LocationService/);
    assert.match(spacesTab, /from "@\/components\/ui\/select"/);
    assert.match(spacesTab, /<SelectTrigger aria-label="Tipo de espacio">/);
    assert.match(spacesTab, /<SelectTrigger aria-label="Espacio padre">/);
    assert.match(spacesTab, /value === "none" \? "" : value/);
    assert.doesNotMatch(spacesTab, /<select/);
    assert.match(taskZones, /Selecciona solo los espacios/);
    assert.match(taskZones, /Tareas sugeridas/);
    assert.match(taskZones, /from "@\/components\/ui\/checkbox"/);
    assert.match(taskZones, /<Checkbox/);
    assert.doesNotMatch(taskZones, /<input\b/);
    assert.match(taskZones, /selectedZoneIds/);
});

test("selected zones stay visible to planners and field workers", () => {
    const taskCard = read("../components/tasks/TaskListCard.tsx");
    const techCard = read("../components/dashboard/TechTaskCard.tsx");

    assert.match(taskCard, /task\.zones/);
    assert.match(techCard, /task\.zones/);
});

test("duplicating a task preserves its selected source spaces", () => {
    const taskCrud = read("../hooks/useTaskCrud.ts");

    assert.match(taskCrud, /zone_ids: task\.zones\?\.map\(\(zone\) => zone\.space_id\)/);
});
