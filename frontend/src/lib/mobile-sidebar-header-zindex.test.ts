import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("mobile sidebar overlay covers the full viewport including header actions", () => {
    const layout = read("../app/dashboard/layout.tsx");
    const header = read("../components/dashboard/DashboardHeader.tsx");
    const notifications = read("../components/dashboard/notifications/NotificationPanel.tsx");
    const notificationPopover = read("../components/dashboard/notifications/NotificationPopoverContent.tsx");
    const notificationUi = `${notifications}\n${notificationPopover}`;
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const globals = read("../app/globals.css");

    assert.match(layout, /fixed inset-0 z-\[var\(--z-sidebar-overlay\)\]/);
    assert.match(layout, /lg:hidden/);
    assert.doesNotMatch(layout, /top-20/);
    assert.match(header, /z-\[var\(--z-header\)\]/);
    assert.doesNotMatch(header, /z-\[55\]/);
    assert.match(header, /NotificationPanel/);
    assert.match(header, /UserAvatar/);
    assert.match(layout, /z-\[var\(--z-dashboard-content\)\]/);

    // Header stacking context must sit above main, below mobile sidebar overlay.
    assert.match(globals, /--z-dashboard-content:\s*10/);
    assert.match(globals, /--z-header:\s*20/);
    assert.match(globals, /--z-header-popover:\s*25/);
    assert.match(globals, /--z-sidebar-overlay:\s*30/);
    assert.match(globals, /--z-sidebar-mobile-open:\s*60/);
    assert.match(globals, /--popover-surface-bg:\s*#323238/);
    assert.match(header, /header-popover-layer/);
    assert.match(header, /\bfixed\b/);
    assert.doesNotMatch(header, /z-\[10050\]/);
    assert.match(notificationUi, /header-popover-layer/);
    assert.match(notificationUi, /\bfixed\b/);
    assert.doesNotMatch(notificationUi, /sm:absolute/);
    assert.doesNotMatch(notificationUi, /z-\[10050\]/);
    assert.match(sidebar, /z-\[var\(--z-sidebar\)\]/);
    assert.match(sidebar, /max-lg:z-\[var\(--z-sidebar-mobile-open\)\]/);
});
