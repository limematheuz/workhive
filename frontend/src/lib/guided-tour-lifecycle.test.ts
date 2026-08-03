import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("guided tour cancels pending timer work and does not scroll on every viewport event", () => {
    const component = readFileSync(
        new URL("../components/onboarding/GuidedTour.tsx", import.meta.url),
        "utf8",
    );

    assert.match(component, /window\.clearTimeout\(delayedMeasure\)/);
    assert.match(component, /window\.clearTimeout\(coordinateMeasure\)/);
    assert.match(component, /const handleViewportChange = \(\) => updatePosition\(false\)/);
    assert.match(component, /updatePosition\(true\)/);
});

test("guided tour overlay does not inspect browser globals while rendering", () => {
    const overlay = readFileSync(
        new URL("../components/onboarding/GuidedTourOverlay.tsx", import.meta.url),
        "utf8",
    );

    assert.doesNotMatch(overlay, /typeof window/);
    assert.match(overlay, /viewport,/);
});
