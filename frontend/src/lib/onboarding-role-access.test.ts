import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { shouldShowCompanyOnboarding } from "../domain/onboarding/cleaning-onboarding.ts";

test("only a company admin receives onboarding without blocking other roles", () => {
    assert.equal(
        shouldShowCompanyOnboarding({ company_id: 1, role: { name: "admin" } }),
        true,
    );
    assert.equal(
        shouldShowCompanyOnboarding({ company_id: 1, role: { name: "manager" } }),
        false,
    );
    assert.equal(
        shouldShowCompanyOnboarding({ company_id: 1, role: { name: "viewer" } }),
        false,
    );
    assert.equal(
        shouldShowCompanyOnboarding({ company_id: null, role: { name: "superadmin" } }),
        false,
    );
});

test("dashboard layout delegates onboarding visibility without role redirects", () => {
    const layout = readFileSync(
        new URL("../app/dashboard/layout.tsx", import.meta.url),
        "utf8",
    );

    assert.match(layout, /shouldShowCompanyOnboarding\(user\)/);
    assert.doesNotMatch(layout, /redirect\([^)]*role/);
});

test("onboarding uses the shared WorkHive dialog glass system", () => {
    const modal = readFileSync(
        new URL("../components/onboarding/OnboardingModal.tsx", import.meta.url),
        "utf8",
    );

    assert.match(modal, /<Dialog open>/);
    assert.match(modal, /<DialogContent/);
    assert.match(modal, /dialog-glass-chrome/);
    assert.match(modal, /glass-panel/);
    assert.doesNotMatch(modal, /fixed inset-0 z-\[9999\]/);
});
