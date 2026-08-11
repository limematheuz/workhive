import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("header popovers use tinted billing-surface shells (no pure white)", () => {
    const header = source("../components/dashboard/DashboardHeader.tsx");
    const notifications = source("../components/dashboard/notifications/NotificationPanel.tsx");
    const notificationPopover = source("../components/dashboard/notifications/NotificationPopoverContent.tsx");
    const notificationUi = `${notifications}\n${notificationPopover}`;
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

    assert.match(notificationUi, /billing-surface/);
    assert.match(notificationUi, /header-popover-layer/);
    assert.match(notificationUi, /billing-block/);
    assert.match(notificationUi, /border-dashed/);
    assert.match(notificationUi, /from "@\/components\/ui\/button"/);
    assert.match(notificationUi, /PremiumTabs/);
    assert.match(notificationUi, /CheckCheck/);
    assert.match(notificationUi, /handleClearActiveTab/);
    assert.doesNotMatch(notificationUi, /surface-popover/);
    assert.doesNotMatch(notificationUi, /\bbg-white\b/);
    assert.doesNotMatch(notificationUi, /#fff(?:fff)?\b/i);
    assert.doesNotMatch(notificationUi, /Trash2/);
    assert.doesNotMatch(notificationUi, /billing-surface-accent-pad/);
    assert.doesNotMatch(notificationUi, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(notificationUi, /btn-cancel-muted/);

    // Floating shell combo stays cool-tinted; light popover token is not near-white.
    assert.match(globals, /\.billing-surface\.header-popover-layer/);
    assert.match(globals, /--popover-surface-bg:\s*#d8e2e9/);
    assert.doesNotMatch(globals, /--popover-surface-bg:\s*#fff(?:fff)?\b/i);
    assert.doesNotMatch(globals, /--popover-surface-bg:\s*#f4f8fb/);
});
