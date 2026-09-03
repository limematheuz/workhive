import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("mobile sidebar uses the shared Sheet above header actions", () => {
    const layout = read("../app/dashboard/layout.tsx");
    const header = read("../components/dashboard/DashboardHeader.tsx");
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const sheet = read("../components/ui/sheet.tsx");
    const globals = read("../app/globals.css");

    assert.match(layout, /SidebarProvider/);
    assert.match(sheet, /fixed inset-0 z-\[100\]/);
    assert.match(sheet, /z-\[101\]/);
    assert.match(header, /z-\[var\(--z-header\)\]/);
    assert.match(header, /SidebarTrigger/);
    assert.match(layout, /z-\[var\(--z-dashboard-content\)\]/);
    assert.match(globals, /--z-dashboard-content:\s*10/);
    assert.match(globals, /--z-header:\s*20/);
    assert.match(sidebar, /ShadcnSidebar collapsible="icon"/);
    assert.match(sidebar, /DropdownMenuContent/);
    assert.match(sidebar, /side=\{isMobile \? "top" : "right"\}/);
    assert.match(sidebar, /align=\{isMobile \? "start" : "end"\}/);
});
