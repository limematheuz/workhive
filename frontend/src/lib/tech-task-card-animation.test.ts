import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("TechTaskCard has no pulse, ping, or overdue badge animation classes", () => {
    const source = readFileSync(
        new URL("../components/dashboard/TechTaskCard.tsx", import.meta.url),
        "utf8",
    );

    assert.doesNotMatch(source, /\banimate-pulse\b/);
    assert.doesNotMatch(source, /\banimate-ping\b/);
    assert.doesNotMatch(source, /\bmotion-safe:animate-ping\b/);
    assert.doesNotMatch(source, /\btech-task-overdue-badge\b/);
});
