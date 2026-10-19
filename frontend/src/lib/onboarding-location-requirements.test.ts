import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("onboarding marks postal code as required everywhere the location step is shown", () => {
    const onboarding = read("../components/onboarding/OnboardingModal.tsx");
    const form = read("../components/locations/LocationWorkspaceForm.tsx");
    const informationStep = read("../components/locations/LocationInfoAccessStep.tsx");
    const types = read("../components/locations/location-workspace-types.ts");

    assert.match(onboarding, /<LocationWorkspaceForm[^>]*requirePostalCode/);
    assert.match(form, /<LocationInfoAccessStep[^>]*requirePostalCode=\{requirePostalCode\}/);
    assert.match(types, /requirePostalCode\?: boolean/);
    assert.match(informationStep, /requirePostalCode\s*\?/);
    assert.match(informationStep, /Código postal\{requirePostalCode\s*\?\s*" \*"\s*:\s*""\}/);
    assert.match(informationStep, /aria-required=\{requirePostalCode\}/);
});
