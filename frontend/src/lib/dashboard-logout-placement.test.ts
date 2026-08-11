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

test("profile popover mirrors notification panel shell and billing action language", () => {
    const header = read("../components/dashboard/DashboardHeader.tsx");
    const notifications = read(
        "../components/dashboard/notifications/NotificationPanel.tsx",
    );
    const notificationPopover = read(
        "../components/dashboard/notifications/NotificationPopoverContent.tsx",
    );

    assert.match(header, /import\s*\{\s*LogOut,\s*User\s*\}\s*from\s*"lucide-react"/);
    assert.match(
        header,
        /billing-surface header-popover-layer fixed left-3 right-3 top-20[\s\S]*?rounded-\[24px\] p-3/,
    );
    assert.match(header, /sm:w-\[min\(25rem,calc\(100vw-2rem\)\)\]/);
    assert.match(
        `${notifications}\n${notificationPopover}`,
        /sm:w-\[min\(25rem,calc\(100vw-2rem\)\)\]/,
    );
    assert.match(header, /billing-block/);
    assert.match(header, /from "@\/components\/ui\/button"/);
    assert.match(header, /from "@\/components\/ui\/badge"/);
    assert.match(header, /variant="dangerSoft"/);
    assert.match(header, /href="\/dashboard\/profile"/);
    assert.match(header, /<LogOut[\s\S]*?aria-hidden="true"/);
    assert.match(header, /aria-label="Abrir menú de perfil"/);
    assert.match(header, /aria-label="Menú de perfil"/);
    assert.doesNotMatch(header, /border-accent\/20 bg-accent\/\[0\.06\]/);
    assert.doesNotMatch(header, /bg-red-500\/10|text-red-500|emerald|text-green-|bg-green-/);
    assert.doesNotMatch(header, /btn-cancel-muted/);
});
