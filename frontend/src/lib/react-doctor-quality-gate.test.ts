import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const workflow = readFileSync(
    new URL("../../../.github/workflows/react-doctor.yml", import.meta.url),
    "utf8",
);
const packageJson = readFileSync(new URL("../../package.json", import.meta.url), "utf8");


test("React Doctor scans the full frontend and blocks every finding", () => {
    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.doesNotMatch(workflow, /pull-requests: write|issues: write|statuses: write/);
    assert.match(workflow, /uses: millionco\/react-doctor@v2/);
    assert.match(workflow, /directory: frontend/);
    assert.match(workflow, /blocking: warning/);
    assert.match(workflow, /scope: full/);
    assert.match(workflow, /version: "0\.9\.3"/);
    assert.doesNotMatch(workflow, /continue-on-error/);
});


test("the local React Doctor command matches the blocking CI policy", () => {
    assert.match(
        packageJson,
        /"doctor": "pnpm dlx react-doctor@0\.9\.3 --blocking warning --scope full"/,
    );
});
