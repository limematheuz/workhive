import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("dark visibility tokens live in globals and drive glass surfaces", () => {
    const globals = read("../app/globals.css");
    const taskCard = read("../components/tasks/TaskListCard.tsx");
    const companies = read("../components/companies/CompaniesListSection.tsx");
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const notifications = read("../components/dashboard/notifications/NotificationPanel.tsx");
    const notificationPopover = read("../components/dashboard/notifications/NotificationPopoverContent.tsx");
    const dialog = read("../components/ui/dialog.tsx");
    const popover = read("../components/ui/popover.tsx");

    assert.match(globals, /--glass-sheet-bg:/);
    assert.match(globals, /--glass-blur:/);
    assert.match(globals, /--surface-card-bg:/);
    assert.match(globals, /--brand-blue-glow:/);
    assert.match(globals, /--brand-blue-sky:/);
    assert.match(globals, /--popover-surface-bg:\s*#323238/);
    assert.match(globals, /--z-header:\s*20/);
    assert.match(globals, /--dialog-bg:\s*rgba\(28,\s*28,\s*32,\s*0\.72\)/);
    assert.match(globals, /--glass-blur-strong:\s*140px/);
    assert.match(globals, /--glass-overlay-blur:\s*28px/);
    assert.match(globals, /--dialog-surface-blur:\s*48px/);
    assert.match(globals, /--glass-sheet-bg:\s*rgba\(28,\s*28,\s*32,\s*0\.72\)/);
    assert.match(globals, /--glass-overlay-bg:\s*rgba\(4,\s*6,\s*12,\s*0\.55\)/);
    assert.match(globals, /\[data-slot="dialog-overlay"\]/);
    assert.match(
      globals,
      /\[data-slot="dialog-content"\][\s\S]*backdrop-filter:\s*blur\(var\(--dialog-surface-blur\)\)/
    );
    assert.match(globals, /\[data-slot="alert-dialog-content"\]\.dialog-glass/);
    assert.match(
      globals,
      /\[data-slot="dialog-overlay"\][\s\S]*backdrop-filter:\s*blur\(var\(--glass-overlay-blur\)\)/
    );
    assert.match(globals, /\[data-slot="dialog-content"\][\s\S]*transform:\s*none/);
    assert.match(globals, /\[data-slot="dialog-overlay"\][\s\S]*transform:\s*none/);
    assert.match(globals, /\.surface-glass-card\s*\{/);
    assert.match(globals, /\.surface-control-btn\s*\{/);
    assert.match(globals, /\.surface-popover[\s\S]*opacity:\s*1/);
    assert.match(globals, /\.glass-panel[\s\S]*var\(--glass-panel-bg\)/);

    // Backlight keeps ambient depth without permanently animating or filtering the shell.
    const backlightBlock = globals.match(/\.dashboard-shell-backlight\s*\{[^}]+\}/)?.[0] ?? "";
    assert.match(backlightBlock, /opacity:\s*0\.3/);
    assert.doesNotMatch(backlightBlock, /--glass-/);
    assert.doesNotMatch(backlightBlock, /filter:/);
    assert.doesNotMatch(backlightBlock, /animation:/);
    assert.doesNotMatch(globals, /dashboard-shell-backlight-drift/);

    // Dead legacy utilities should stay removed.
    assert.doesNotMatch(globals, /\.glass-card\s*\{/);
    assert.doesNotMatch(globals, /\.input-field\s*\{/);
    assert.doesNotMatch(globals, /--sidebar-active-shadow/);

    assert.match(taskCard, /billing-block/);
    assert.match(companies, /billing-surface/);
    assert.match(companies, /from "@\/components\/ui\/table"/);
    assert.doesNotMatch(companies, /surface-glass-card/);
    assert.match(sidebar, /DropdownMenuContent/);
    assert.match(sidebar, /components\/ui\/dropdown-menu/);
    const notificationUi = `${notifications}\n${notificationPopover}`;
    assert.match(notificationUi, /billing-surface/);
    assert.match(notificationUi, /header-popover-layer/);
    assert.match(popover, /surface-popover/);
    assert.match(dialog, /dialog-glass-overlay/);
    assert.match(dialog, /dialog-glass/);
    assert.match(dialog, /inset-0/);
    assert.match(dialog, /m-auto/);
    assert.doesNotMatch(dialog, /translate-x-\[-50%\]/);
    assert.doesNotMatch(dialog, /zoom-in-95/);
});
