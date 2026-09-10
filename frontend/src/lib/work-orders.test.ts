import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("work orders have an independent operational service and page", () => {
    const service = read("../services/work-order.service.ts");
    const page = read("../app/dashboard/work-orders/page.tsx");
    const sidebar = read("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(service, /\/api\/v1\/work-orders\//);
    assert.match(service, /contract-candidates/);
    assert.match(service, /generate/);
    assert.match(page, /DataListTable/);
    assert.match(page, /Nueva orden/);
    assert.match(page, /Generar tarea/);
    assert.match(sidebar, /"\/dashboard\/work-orders"/);
});
