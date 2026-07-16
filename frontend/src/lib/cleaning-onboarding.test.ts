import assert from "node:assert/strict";
import test from "node:test";

import {
    buildCompanyOnboardingInput,
    defaultLocationTypeForModel,
    isOnboardingLocationComplete,
} from "../domain/onboarding/cleaning-onboarding.ts";

test("operating models choose a useful location default", () => {
    assert.equal(defaultLocationTypeForModel("service_provider"), "private");
    assert.equal(defaultLocationTypeForModel("property_manager"), "real_estate");
    assert.equal(defaultLocationTypeForModel("hybrid"), "real_estate");
});

test("onboarding payload trims fields and exposes no tenant identifiers", () => {
    const payload = buildCompanyOnboardingInput("property_manager", {
        name: "  Apartamento Marina  ",
        address: " Carrer Mar 2 ",
        city: " L'Escala ",
        postalCode: " 17130 ",
        locationType: "real_estate",
    });

    assert.deepEqual(payload, {
        operating_model: "property_manager",
        location: {
            name: "Apartamento Marina",
            address: "Carrer Mar 2",
            city: "L'Escala",
            postal_code: "17130",
            location_type: "real_estate",
        },
    });
    assert.equal("company_id" in payload, false);
    assert.equal("owner_company_id" in (payload.location || {}), false);
});

test("location completeness rejects whitespace-only required values", () => {
    assert.equal(
        isOnboardingLocationComplete({
            name: "Casa",
            address: "  ",
            city: "Girona",
            postalCode: "17001",
            locationType: "private",
        }),
        false,
    );
    assert.equal(
        isOnboardingLocationComplete({
            name: "Casa",
            address: "Carrer 1",
            city: "Girona",
            postalCode: "17001",
            locationType: "private",
        }),
        true,
    );
});
