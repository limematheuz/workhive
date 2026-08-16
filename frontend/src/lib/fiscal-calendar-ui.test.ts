import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const page = readFileSync(resolve(root, "app/dashboard/fiscal-calendar/page.tsx"), "utf8");
const sidebar = readFileSync(resolve(root, "components/dashboard/sidebar-nav-config.tsx"), "utf8");

test("fiscal calendar is company-admin scoped and saves explicit obligations", () => {
    assert.match(page, /canAdministerCompany\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /quarterly_vat_enabled/);
    assert.match(page, /quarterly_withholding_enabled/);
    assert.match(page, /fiscal_reminder_days/);
    assert.match(page, /FiscalSettingsService\.updateSettings/);
});

test("fiscal calendar reuses dashboard navigation and surfaces official-date guidance", () => {
    assert.match(sidebar, /href: "\/dashboard\/fiscal-calendar"/);
    assert.match(page, /billing-surface/);
    assert.match(page, /official_notice/);
    assert.match(page, /AEAT_CALENDAR_URL/);
});
