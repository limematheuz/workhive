import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("custom commercial configuration records terms and is not a trial flow", () => {
    const service = source("../services/company-plan-access.service.ts");
    const hook = source("../components/companies/useCompanyPlanAccessDialog.ts");
    const dialog = source("../components/companies/CompanyPlanAccessDialog.tsx");

    assert.match(service, /commercial_terms\?: CommercialTerms/);
    assert.match(hook, /commercialTermsChanges/);
    assert.match(hook, /commercial_terms: nextTerms/);
    assert.match(dialog, /company-custom-commercial-terms/);
    assert.match(dialog, /Las ampliaciones solo se aplican a una suscripción activa/);
    assert.doesNotMatch(dialog, /bg-green-|text-green-|emerald/);
});
