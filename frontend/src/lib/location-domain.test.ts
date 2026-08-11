import assert from "node:assert/strict";
import test from "node:test";

import {
    getEffectiveLocationTemplate,
} from "../domain/locations/location-template.ts";
import {
    LOCATION_TYPE_OPTIONS,
    getLocationTypeLabel,
    normalizeLocationType,
} from "../domain/locations/location-type.ts";

test("location type normalization keeps legacy particular as private", () => {
    assert.equal(normalizeLocationType("particular"), "private");
    assert.equal(normalizeLocationType(null), "private");
    assert.equal(normalizeLocationType("business"), "business");
    assert.deepEqual(LOCATION_TYPE_OPTIONS, [
        "private",
        "real_estate",
        "business",
        "exterior",
        "other",
    ]);
});

test("location type label falls back to other label", () => {
    const labels = {
        private: "Vivienda particular",
        business: "Negocio",
        other: "Otro",
    };

    assert.equal(getLocationTypeLabel("particular", labels), "Vivienda particular");
    assert.equal(getLocationTypeLabel("business", labels), "Negocio");
    assert.equal(getLocationTypeLabel("missing", labels), "Otro");
});

test("effective location template prefers trimmed custom fields and template fallbacks", () => {
    assert.deepEqual(
        getEffectiveLocationTemplate(
            {
                custom_name: " Limpieza premium ",
                custom_description: null,
                custom_price: null,
                custom_unit: " servicio ",
            },
            {
                id: 1,
                company_id: 1,
                name: "Limpieza base",
                description: "Base",
                default_price: 100,
                unit: "hour",
                is_active: true,
            },
        ),
        {
            name: "Limpieza premium",
            description: "Base",
            price: 100,
            unit: "servicio",
            pricingMode: "fixed",
        },
    );

    assert.deepEqual(getEffectiveLocationTemplate({}, undefined), {
        name: "",
        description: null,
        price: null,
        unit: "unit",
        pricingMode: "fixed",
    });
});

test("effective location template preserves hourly pricing from its template", () => {
    assert.deepEqual(
        getEffectiveLocationTemplate(
            { custom_price: 28 },
            {
                id: 1,
                company_id: 1,
                name: "Refuerzo",
                default_price: 24,
                unit: "service",
                pricing_mode: "hourly",
                is_active: true,
            },
        ),
        {
            name: "Refuerzo",
            description: null,
            price: 28,
            unit: "service",
            pricingMode: "hourly",
        },
    );
});
