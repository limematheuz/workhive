import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("time corrections keep requests and approvals in a dedicated scoped workspace", () => {
    const service = read("../services/work-session-correction.service.ts");
    const page = read("../app/dashboard/time-corrections/page.tsx");
    const sidebar = read("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(service, /\/api\/v1\/work-session-corrections/);
    assert.match(service, /review_queue=true/);
    assert.match(service, /requestCorrection/);
    assert.match(service, /reviewCorrection/);
    assert.match(page, /DataListTable/);
    assert.match(page, /DateTimePicker/);
    assert.match(page, /Solicitar corrección/);
    assert.match(page, /Solo se muestran las peticiones de las ubicaciones incluidas en tu permiso/);
    assert.match(page, /canManageTime\(user\)/);
    assert.match(sidebar, /flags\.canManageTime/);
    assert.match(sidebar, /"\/dashboard\/time-corrections"/);
});
