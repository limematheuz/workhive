import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("client portal has an isolated documentary shell and multi-company workspace selector", () => {
    const layout = read("../app/dashboard/layout.tsx");
    const sidebar = read("../components/dashboard/Sidebar.tsx");
    const navigation = read("../components/dashboard/sidebar-nav-config.tsx");
    const workspace = read("../components/client-portal/ClientPortalWorkspace.tsx");
    const service = read("../services/client-portal.service.ts");
    const acceptance = read("../app/(auth)/accept-client-portal-invitation/AcceptClientPortalInvitationClient.tsx");
    const api = read("../lib/api.ts");

    assert.match(layout, /canAccessClientPortalDashboardPath/);
    assert.match(layout, /if \(isClientPortal && !canAccessClientPortalDashboardPath\(pathname\)\)/);
    assert.match(sidebar, /isClientPortalRole/);
    assert.match(sidebar, /isClientPortal \? "\/dashboard\/client\/profile"/);
    assert.match(navigation, /isClientPortal/);
    assert.match(workspace, /ClientPortalService\.getWorkspaces/);
    assert.match(workspace, /<Select/);
    assert.match(service, /\/client-portal\/workspaces/);
    assert.match(service, /downloadInvoice/);
    assert.match(acceptance, /resolveInvitationToken/);
    assert.match(acceptance, /ClientPortalService\.acceptInvitation/);
    assert.match(api, /\/api\/v1\/client-portal\/invitations\/accept/);
});

test("tabs with more than four items use the same picker on tablet and mobile", () => {
    const tabs = read("../components/ui/premium-tabs.tsx");

    assert.match(tabs, /tabs\.length > 4/);
    assert.match(tabs, /lg:hidden/);
    assert.match(tabs, /hidden lg:flex/);
});
