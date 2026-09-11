import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/dashboard/quality/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../components/dashboard/sidebar-nav-config.tsx", import.meta.url), "utf8");

test("quality has a protected dedicated workspace in Operations", () => {
    assert.match(page, /canViewQuality\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /QualityService\.getTemplates/);
    assert.match(page, /DataListTable/);
    assert.match(page, /PremiumTabs/);
    assert.doesNotMatch(page, /\bfetch\s*\(/);
    assert.match(sidebar, /href: "\/dashboard\/quality", label: "Calidad"/);
});
