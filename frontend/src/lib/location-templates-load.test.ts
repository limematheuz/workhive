import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadLocationTemplatesBundle } from "./load-location-templates-bundle.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("location templates bundle soft-fails house 500 and keeps global templates", async () => {
    const bundle = await loadLocationTemplatesBundle(42, {
        getHouseTemplates: async () => {
            throw new Error("Internal Server Error");
        },
        getGlobalTemplates: async () => [
            {
                id: 7,
                name: "Limpieza",
                description: "- [ ] Suelo",
                default_price: 100,
                unit: "service",
                is_active: true,
                company_id: 1,
            },
        ],
    });

    assert.deepEqual(bundle.houseTemplates, []);
    assert.equal(bundle.houseTemplatesError, "Internal Server Error");
    assert.equal(bundle.globalTemplates.length, 1);
    assert.equal(bundle.globalTemplates[0].name, "Limpieza");
    assert.equal(bundle.globalTemplatesError, null);
});

test("location templates bundle soft-fails global templates without wiping house list", async () => {
    const bundle = await loadLocationTemplatesBundle(9, {
        getHouseTemplates: async () => [
            {
                location_id: 9,
                template_task_id: 3,
                custom_price: null,
                custom_name: null,
                custom_description: null,
                custom_unit: null,
                template: {
                    id: 3,
                    name: "Fija",
                    description: null,
                    default_price: 50,
                    unit: "service",
                    company_id: 1,
                },
            },
        ],
        getGlobalTemplates: async () => {
            throw new Error("Error loading templates");
        },
    });

    assert.equal(bundle.houseTemplates.length, 1);
    assert.equal(bundle.houseTemplatesError, null);
    assert.deepEqual(bundle.globalTemplates, []);
    assert.equal(bundle.globalTemplatesError, "Error loading templates");
});

test("location tasks sheet uses soft-fail templates bundle instead of Promise.all", () => {
    const hook = read("../hooks/useLocationTasksSheet.ts");
    const service = read("../services/template.service.ts");

    assert.match(hook, /loadLocationTemplatesBundle/);
    assert.doesNotMatch(
        hook,
        /Promise\.all\(\[\s*LocationTemplateService\.getTemplates/,
    );
    assert.match(service, /Error loading location templates/);
    assert.match(service, /if \(!response\.ok\)/);
});
