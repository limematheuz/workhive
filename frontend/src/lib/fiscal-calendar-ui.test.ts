import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const page = readFileSync(resolve(root, "app/dashboard/fiscal-calendar/page.tsx"), "utf8");
const sidebar = readFileSync(resolve(root, "components/dashboard/sidebar-nav-config.tsx"), "utf8");
const fiscalSettingsDialog = readFileSync(resolve(root, "components/invoices/FiscalSettingsConfigureDialog.tsx"), "utf8");

test("fiscal calendar is finance-manager scoped and saves explicit obligations", () => {
    assert.match(page, /canManageFinance\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /quarterly_vat_enabled/);
    assert.match(page, /quarterly_withholding_enabled/);
    assert.match(page, /fiscal_reminder_days/);
    assert.match(page, /FiscalSettingsService\.updateSettings/);
    assert.match(page, /timeZone: "UTC"/);
});

test("fiscal calendar reuses dashboard navigation and surfaces official-date guidance", () => {
    assert.match(sidebar, /href: "\/dashboard\/fiscal-calendar"/);
    assert.match(page, /billing-surface/);
    assert.match(page, /official_notice/);
    assert.match(page, /AEAT_CALENDAR_URL/);
    assert.match(page, /https:\/\/sede\.agenciatributaria\.gob\.es\/Sede\/calendario-contribuyente\.html/);
});

test("fiscal calendar uses the shared form controls for preferences", () => {
    assert.match(page, /from "@\/components\/ui\/input"/);
    assert.match(page, /<Input[\s\S]+inputMode="numeric"/);
    assert.doesNotMatch(page, /<input\b/);
});

test("Facturae settings use shared checkbox and select controls", () => {
    assert.match(fiscalSettingsDialog, /from "@\/components\/ui\/checkbox"/);
    assert.match(fiscalSettingsDialog, /from "@\/components\/ui\/select"/);
    assert.match(fiscalSettingsDialog, /<Checkbox/);
    assert.match(fiscalSettingsDialog, /<SelectTrigger aria-label=\{text\.environmentAriaLabel\}/);
    assert.doesNotMatch(fiscalSettingsDialog, /<input\s+type="checkbox"|<select/);
});
