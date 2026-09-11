import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("sidebar uses the shared shadcn sidebar, Sheet, and tooltips instead of a bespoke mobile menu", () => {
    const primitive = read("../components/ui/sidebar.tsx");
    const sheet = read("../components/ui/sheet.tsx");
    const layout = read("../app/dashboard/layout.tsx");

    assert.match(primitive, /function SidebarProvider/);
    assert.match(primitive, /<Sheet open=\{openMobile\}/);
    assert.match(primitive, /TooltipContent/);
    assert.match(sheet, /Dialog as SheetPrimitive/);
    assert.match(layout, /workhive_set_sidebar_open/);
    assert.doesNotMatch(layout, /Mobile overlay/);
});

test("sidebar groups navigation by domain while preserving role and feature filtering", () => {
    const config = read("../components/dashboard/sidebar-nav-config.tsx");
    const navigation = read("../components/dashboard/SidebarNavigation.tsx");
    const sidebar = read("../components/dashboard/Sidebar.tsx");

    for (const group of ["operations", "clients", "billing", "organization", "platform"]) {
        assert.match(config, new RegExp(`group\\(\\"${group}\\"`));
    }
    assert.match(config, /NAVIGATION_FEATURES/);
    assert.match(config, /PLATFORM_SUPERADMIN_HREFS/);
    assert.match(config, /ACCOUNTANT_HREFS/);
    assert.match(navigation, /state === "collapsed"/);
    assert.match(navigation, /!overflow-y-auto/);
    assert.match(navigation, /scrollbar-width:none/);
    assert.match(navigation, /sidebar-group-content/);
    assert.match(navigation, /sidebar-group-close_130ms/);
    assert.match(navigation, /tooltip=\{item\.label\}/);
    assert.match(navigation, /const open = props\.openGroups\[group\.id\] \?\? active/);
    assert.match(sidebar, /Object\.fromEntries\(navigation\.navGroups\.map/);
});

test("profile actions have one home in the sidebar footer, not a duplicate header menu", () => {
    const header = read("../components/dashboard/DashboardHeader.tsx");
    const sidebar = read("../components/dashboard/Sidebar.tsx");

    assert.match(sidebar, /SidebarFooter/);
    assert.match(sidebar, /isPartnerPortal \? "\/dashboard\/partner\/profile" : "\/dashboard\/profile"/);
    assert.match(sidebar, /onSelect=\{onLogout\}/);
    assert.doesNotMatch(header, /UserAvatar/);
    assert.doesNotMatch(header, /Abrir menú de perfil/);
});
