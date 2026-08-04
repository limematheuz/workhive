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

test("profile popover mirrors notification panel shell and action cards", () => {
    const header = read("../components/dashboard/DashboardHeader.tsx");
    const notifications = read(
        "../components/dashboard/notifications/NotificationPanel.tsx",
    );

    assert.match(header, /import\s*\{\s*LogOut,\s*User\s*\}\s*from\s*"lucide-react"/);
    assert.match(
        header,
        /surface-popover header-popover-layer fixed left-3 right-3 top-20[\s\S]*?rounded-3xl p-4/,
    );
    assert.match(header, /sm:w-\[min\(25rem,calc\(100vw-2rem\)\)\]/);
    assert.match(notifications, /sm:w-\[min\(25rem,calc\(100vw-2rem\)\)\]/);
    assert.match(header, /font-black text-\[var\(--text-main\)\]/);
    assert.match(header, /font-semibold text-\[var\(--text-muted\)\]/);
    assert.match(header, /border border-accent\/20 bg-accent\/\[0\.06\]/);
    assert.match(header, /text-\[10px\] font-bold uppercase[\s\S]*?text-accent/);
    assert.match(header, /href="\/dashboard\/profile"/);
    assert.match(header, /bg-\[var\(--btn-neutral-bg\)\]/);
    assert.match(header, /bg-red-500\/10[\s\S]*?text-red-500/);
    assert.match(header, /<LogOut[\s\S]*?aria-hidden="true"/);
    assert.match(header, /aria-label="Abrir menú de perfil"/);
    assert.match(header, /aria-label="Menú de perfil"/);
});
