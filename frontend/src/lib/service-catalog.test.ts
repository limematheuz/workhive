import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("service catalog exposes operational terms and immutable version history through shared UI", () => {
    const catalog = source("../components/tasks/TasksTemplates.tsx");
    const form = source("../components/tasks/TemplateModal.tsx");
    const history = source("../components/tasks/ServiceVersionHistoryDialog.tsx");
    const hook = source("../hooks/useTemplateCrud.ts");
    const service = source("../services/template.service.ts");
    const taskTypes = source("../types/user.ts");

    assert.match(catalog, /Catálogo de servicios/);
    assert.match(catalog, /ServiceVersionHistoryDialog/);
    assert.match(catalog, /TemplateTaskService\.getVersions/);
    assert.match(catalog, /catalog_version/);
    assert.match(form, /tmplDurationMinutes/);
    assert.match(form, /tmplRequirements/);
    assert.match(form, /from "@\/components\/ui\/select"/);
    assert.match(history, /formatVersionDate/);
    assert.match(history, /Publicada/);
    assert.match(hook, /estimated_duration_minutes/);
    assert.match(hook, /requirements/);
    assert.match(service, /\/versions/);
    assert.match(taskTypes, /service_catalog_version_id/);
    assert.doesNotMatch(hook, /fetch\(/);
});
