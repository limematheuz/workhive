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
        /"doctor": "pnpm dlx react-doctor@0\.9\.12 --blocking warning --scope full"/,
    );
});


test("icon-only task and room controls expose accessible names", () => {
    assert.match(roomsSection, /aria-label=\{dict\.locations\.form\.rooms_remove\}/);
    assert.match(roomsSection, /aria-label=\{dict\.locations\.form\.rooms_decrease/);
    assert.match(roomsSection, /aria-label=\{dict\.locations\.form\.rooms_increase/);
    assert.match(checklistEditor, /aria-label=\{item\.checked \? `Marcar pendiente:/);
});
