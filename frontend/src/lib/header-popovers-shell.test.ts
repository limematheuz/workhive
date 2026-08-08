import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("header popovers use tinted billing-surface shells (no pure white)", () => {
    const header = source("../components/dashboard/DashboardHeader.tsx");
    const notifications = source("../components/dashboard/notifications/NotificationPanel.tsx");
    const globals = source("../app/globals.css");

    assert.match(header, /billing-surface/);
    assert.match(header, /header-popover-layer/);
    assert.match(header, /billing-block/);
    assert.match(header, /from "@\/components\/ui\/badge"/);
    assert.match(header, /from "@\/components\/ui\/button"/);
    assert.match(header, /variant="outline"/);
    assert.match(header, /variant="dangerSoft"/);
    assert.match(header, /href="\/dashboard\/profile"/);
    assert.match(header, /onLogout\(\)/);
    assert.doesNotMatch(header, /surface-popover/);
    assert.doesNotMatch(header, /\bbg-white\b/);
    assert.doesNotMatch(header, /#fff(?:fff)?\b/i);
    assert.doesNotMatch(header, /billing-surface-accent-pad/);
    assert.doesNotMatch(header, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(header, /btn-cancel-muted/);

    assert.match(notifications, /billing-surface/);
    assert.match(notifications, /header-popover-layer/);
    assert.match(notifications, /billing-block/);
    assert.match(notifications, /border-dashed/);
    assert.match(notifications, /from "@\/components\/ui\/button"/);
    assert.match(notifications, /PremiumTabs/);
    assert.match(notifications, /CheckCheck/);
    assert.match(notifications, /handleClearActiveTab/);
    assert.doesNotMatch(notifications, /surface-popover/);
    assert.doesNotMatch(notifications, /\bbg-white\b/);
    assert.doesNotMatch(notifications, /#fff(?:fff)?\b/i);
    assert.doesNotMatch(notifications, /Trash2/);
    assert.doesNotMatch(notifications, /billing-surface-accent-pad/);
    assert.doesNotMatch(notifications, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(notifications, /btn-cancel-muted/);

    // Floating shell combo stays cool-tinted; light popover token is not near-white.
    assert.match(globals, /\.billing-surface\.header-popover-layer/);
    assert.match(globals, /--popover-surface-bg:\s*#d8e2e9/);
    assert.doesNotMatch(globals, /--popover-surface-bg:\s*#fff(?:fff)?\b/i);
    assert.doesNotMatch(globals, /--popover-surface-bg:\s*#f4f8fb/);
});
