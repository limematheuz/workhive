import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("header notifications and sidebar account menu use tinted surfaces (no pure white)", () => {
    const sidebar = source("../components/dashboard/Sidebar.tsx");
    const notifications = source("../components/dashboard/notifications/NotificationPanel.tsx");
    const notificationPopover = source("../components/dashboard/notifications/NotificationPopoverContent.tsx");
    const notificationUi = `${notifications}\n${notificationPopover}`;
    const globals = source("../app/globals.css");

    assert.match(sidebar, /DropdownMenuContent/);
    assert.match(sidebar, /href="\/dashboard\/profile"/);
    assert.match(sidebar, /onSelect=\{onLogout\}/);
    assert.doesNotMatch(sidebar, /\bbg-white\b/);
    assert.doesNotMatch(sidebar, /#fff(?:fff)?\b/i);
    assert.match(notificationUi, /billing-surface/);
    assert.match(notificationUi, /header-popover-layer/);
    assert.doesNotMatch(notificationUi, /\bbg-white\b/);
    assert.match(globals, /--popover-surface-bg:\s*#d8e2e9/);
    const dropdown = source("../components/ui/dropdown-menu.tsx");
    assert.match(dropdown, /color-mix\(in srgb, var\(--popover-surface-bg\) 78%, transparent\)/);
    assert.match(dropdown, /backdropFilter: "blur\(var\(--popover-surface-blur\)\)/);
    assert.match(dropdown, /hover:bg-\[var\(--bg-tertiary\)\]/);
});
