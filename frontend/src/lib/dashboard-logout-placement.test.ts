import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("dashboard logout is exposed from the sidebar account menu and wired to the layout handler", () => {
    const layout = read("../app/dashboard/layout.tsx");
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const sidebarFooter = read("../components/dashboard/SidebarFooterControls.tsx");

    assert.match(sidebar, /onLogout: \(\) => void/);
    assert.match(sidebar, /onSelect=\{onLogout\}/);
    assert.match(layout, /<Sidebar[\s\S]*?onLogout=\{onLogout\}/);
    assert.doesNotMatch(sidebarFooter, /onLogout|logoutLabel/);
});

test("profile menu lives in the sidebar and uses the shared menu primitive", () => {
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const notifications = read("../components/dashboard/notifications/NotificationPanel.tsx");
    const notificationPopover = read("../components/dashboard/notifications/NotificationPopoverContent.tsx");

    assert.match(sidebar, /DropdownMenuContent/);
    assert.match(sidebar, /SidebarFooter/);
    assert.match(sidebar, /href="\/dashboard\/profile"/);
    assert.match(sidebar, /<LogOut/);
    assert.match(sidebar, /<UserAvatar/);
    assert.match(`${notifications}\n${notificationPopover}`, /header-popover-layer/);
});
