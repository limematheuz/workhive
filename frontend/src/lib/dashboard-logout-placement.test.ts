import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("dashboard logout is exposed from the profile menu and wired to the layout handler", () => {
    const header = read("../components/dashboard/DashboardHeader.tsx");
    const layout = read("../app/dashboard/layout.tsx");
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const sidebarFooter = read(
        "../components/dashboard/SidebarFooterControls.tsx",
    );

    assert.match(header, /onLogout:\s*\(\)\s*=>\s*void/);
    assert.match(header, /onLogout\(\)/);
    assert.match(layout, /<DashboardHeader[\s\S]*?onLogout=\{handleLogout\}/);
    assert.doesNotMatch(sidebar, /onLogout/);
    assert.doesNotMatch(sidebarFooter, /onLogout|logoutLabel/);
});
