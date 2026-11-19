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
    const spaceEditor = read("../components/operations/SpaceWorkforceEditor.tsx");

    assert.match(spacesTab, /Espacios y tareas/);
    assert.match(spacesTab, /LocationService/);
    assert.match(spacesTab, /from "@\/components\/ui\/select"/);
    assert.match(spacesTab, /<SelectTrigger aria-label="Tipo de espacio">/);
    assert.match(spacesTab, /<SelectTrigger aria-label="Espacio padre">/);
    assert.match(spacesTab, /value === "none" \? "" : value/);
    assert.doesNotMatch(spacesTab, /<select/);
    assert.match(spaceEditor, /Selecciona únicamente la parte/);
    assert.match(spaceEditor, /Tareas incluidas/);
    assert.match(spaceEditor, /from "@\/components\/ui\/checkbox"/);
    assert.match(spaceEditor, /<Checkbox/);
    assert.doesNotMatch(spaceEditor, /<input\b/);
    assert.match(taskZones, /SpaceWorkforceEditor/);
    assert.match(taskZones, /selectedZoneIds/);
});

test("selected zones stay visible to planners and field workers", () => {
    const taskCard = read("../components/tasks/TaskListCard.tsx");
    const techCard = read("../components/dashboard/TechTaskCard.tsx");

    assert.match(taskCard, /task\.zones/);
    assert.match(techCard, /task\.zones/);
});

test("both task views duplicate the stored definition through the service", () => {
    for (const path of ["../hooks/useTaskCrud.ts", "../hooks/useOperationsCalendar.ts"]) {
        assert.match(read(path), /TaskService\.duplicateTaskItem\(task\.id\)/);
    }
});
