import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const workflow = readFileSync(
    new URL("../../../.github/workflows/react-doctor.yml", import.meta.url),
    "utf8",
);
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");
const roomsSection = readFileSync(
    new URL("../components/locations/LocationFormRoomsSection.tsx", import.meta.url),
    "utf8",
);
const checklistEditor = readFileSync(
    new URL("../components/tasks/TaskChecklistEditor.tsx", import.meta.url),
    "utf8",
);
const bulkImportDialog = readFileSync(
    new URL("../components/locations/LocationBulkImportDialog.tsx", import.meta.url),
    "utf8",
);
const spacesStep = readFileSync(
    new URL("../components/locations/LocationSpacesStep.tsx", import.meta.url),
    "utf8",
);
const spacesTab = readFileSync(
    new URL("../components/locations/LocationSpacesTab.tsx", import.meta.url),
    "utf8",
);
const workspaceForm = readFileSync(
    new URL("../components/locations/LocationWorkspaceForm.tsx", import.meta.url),
    "utf8",
);
const taskZones = readFileSync(
    new URL("../components/tasks/TaskCreateZonesSection.tsx", import.meta.url),
    "utf8",
);


test("React Doctor scans the full frontend and blocks every finding", () => {
    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.doesNotMatch(workflow, /pull-requests: write|issues: write|statuses: write/);
    assert.match(workflow, /uses: millionco\/react-doctor@v2/);
    assert.match(workflow, /directory: frontend/);
    assert.match(workflow, /blocking: warning/);
    assert.match(workflow, /scope: full/);
    assert.match(workflow, /version: "0\.9\.12"/);
    assert.doesNotMatch(workflow, /continue-on-error/);
});


test("the local React Doctor command matches the blocking CI policy", () => {
    assert.match(
        packageJson,
        /"doctor": "react-doctor \. --blocking warning --scope full"/,
    );
});


test("icon-only task and room controls expose accessible names", () => {
    assert.match(roomsSection, /aria-label=\{dict\.locations\.form\.rooms_remove\}/);
    assert.match(roomsSection, /aria-label=\{dict\.locations\.form\.rooms_decrease/);
    assert.match(roomsSection, /aria-label=\{dict\.locations\.form\.rooms_increase/);
    assert.match(checklistEditor, /aria-label=\{item\.checked \? `Marcar pendiente:/);
});

test("location workspace keeps the React Doctor constraints that previously blocked PRs", () => {
    assert.match(bulkImportDialog, /function downloadLocationTemplate/);
    assert.match(bulkImportDialog, /aria-label="Archivo CSV de ubicaciones"/);
    assert.doesNotMatch(spacesStep, /key=\{`\$\{space\.name\}-\$\{index\}`\}/);
    assert.match(spacesStep, /aria-label="Tipo de espacio"/);
    assert.match(spacesTab, /aria-label=\{`Añadir tarea a \$\{space\.name\}`\}/);
    assert.match(workspaceForm, /useState\(\(\) => location\?\.client_id/);
    assert.match(taskZones, /new Set\(selectedZoneIds\)/);
    assert.match(taskZones, /selectedZoneIdSet\.has/);
    assert.match(taskZones, /selectedSpaceTaskTemplateIdSet\.has/);
});
