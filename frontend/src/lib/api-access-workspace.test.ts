import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("API access uses the service layer and keeps the raw credential one-time only", () => {
    const page = read("../app/dashboard/api-access/page.tsx");
    const workspace = read("../components/api-access/ApiAccessWorkspace.tsx");
    const service = read("../services/api-access-key.service.ts");
    const sidebar = read("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(page, /ApiAccessWorkspace/);
    assert.match(workspace, /ApiAccessKeyService\.list/);
    assert.match(workspace, /ApiAccessKeyService\.create/);
    assert.match(workspace, /ApiAccessKeyService\.revoke/);
    assert.match(workspace, /navigator\.clipboard\.writeText/);
    assert.match(workspace, /solo se muestra una vez/);
    assert.doesNotMatch(workspace, /\bfetch\s*\(/);
    assert.match(service, /\/api\/v1\/api-access-keys\//);
    assert.match(service, /assertApiResponseOk/);
    assert.match(sidebar, /"\/dashboard\/api-access": "features\.api"/);
    assert.match(sidebar, /href: "\/dashboard\/api-access", label: "Acceso API"/);
});
