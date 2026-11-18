import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {WORKSPACE_NAVIGATION,navigationFeatureEnabled,navigationGroupForPath} from "../domain/navigation/workspace-navigation.ts";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("daily navigation follows planning, execution, customers and people before business administration",()=>{
    assert.deepEqual(WORKSPACE_NAVIGATION.filter(group=>group.section==="daily").map(group=>group.id),["home","planning","operations","clients","staff"]);
    const sections=WORKSPACE_NAVIGATION.map(group=>group.section);
    assert.ok(sections.indexOf("business")>sections.lastIndexOf("daily"));
    assert.ok(sections.indexOf("administration")>sections.lastIndexOf("business"));
    const routes=WORKSPACE_NAVIGATION.flatMap(group=>group.hrefs);
    assert.equal(new Set(routes).size,routes.length,"Each destination must have one home");
    for(const href of ["/dashboard/planificar","/dashboard/calculator","/dashboard/management","/dashboard/commercial","/dashboard/portals"]){
        assert.equal(routes.filter(route=>route===href).length,1);
    }
});

test("feature visibility preserves optional modules and supports either authorised external portal",()=>{
    const enabled=new Set(["features.work_orders","features.accountant_portal"]);
    assert.equal(navigationFeatureEnabled(enabled,"features.work_orders"),true);
    assert.equal(navigationFeatureEnabled(enabled,"features.quotes"),false);
    assert.equal(navigationFeatureEnabled(enabled,["features.client_portal","features.accountant_portal"]),true);
    assert.equal(navigationFeatureEnabled(new Set<string>(),["features.client_portal","features.accountant_portal"]),false);
    assert.equal(navigationFeatureEnabled(null,"features.work_orders"),true);
});

test("breadcrumbs use path boundaries and the most specific workspace group",()=>{
    assert.equal(navigationGroupForPath("/dashboard/quotes/123")?.id,"commercial");
    assert.equal(navigationGroupForPath("/dashboard/plantilla/equipos")?.id,"staff");
    assert.equal(navigationGroupForPath("/dashboard/work-orders")?.id,"planning");
    assert.equal(navigationGroupForPath("/dashboard/services")?.id,"commercial");
    assert.equal(navigationGroupForPath("/dashboard/portals")?.id,"applications");
    assert.equal(navigationGroupForPath("/dashboard/portals")?.section,"administration");
    assert.equal(navigationGroupForPath("/dashboard/management")?.id,"reports");
    assert.equal(navigationGroupForPath("/dashboard/clients-unrelated"),undefined);
});

test("compact and mobile navigation retain destinations and accessible actions",()=>{
    const navigation=read("../components/dashboard/SidebarNavigation.tsx");
    const primitive=read("../components/ui/sidebar.tsx");
    const sidebar=read("../components/dashboard/Sidebar.tsx");
    for(const behaviour of ['state === "collapsed" && !isMobile','DropdownMenuTrigger','group.children.map','aria-label={group.label}','aria-label={collapsed ? item.label : undefined}','if (isMobile) setOpenMobile(false)','props.openGroups[group.id] ?? active'])assert.ok(navigation.includes(behaviour),behaviour);
    assert.ok(!navigation.includes('uppercase tracking'));
    assert.ok(primitive.includes('const isCollapsed = state === "collapsed" && !isMobile'));
    assert.ok(primitive.includes('md:group-data-[state=collapsed]/sidebar-wrapper:hidden'));
    assert.ok(sidebar.includes('const expanded = state === "expanded" || isMobile'));
});

test("lead and private cost navigation use explicit capabilities and keep the external shells isolated",()=>{
    const config=read("../components/dashboard/sidebar-nav-config.tsx");
    const sidebar=read("../components/dashboard/Sidebar.tsx");
    const provider=read("../components/dashboard/WorkspaceNavigationProvider.tsx");
    assert.ok(sidebar.includes('useWorkspaceNavigation()'));
    assert.ok(provider.includes('permissions["commercial.follow_ups.read"]===true'));
    assert.ok(config.includes('flags.canReadCommercial ? [{ href: "/dashboard/commercial"'));
    assert.ok(config.includes('flags.canViewFinance && flags.canViewLaborCosts ? ['));
    assert.ok(config.includes('flags.isCompanyAdmin ? [{ href: "/dashboard/portals"'));
    assert.ok(config.includes('flags.canManageWork ? [{ href: "/dashboard/services"'));
    assert.ok(provider.includes('work:permissions["work.manage"]===true'));
    assert.ok(provider.includes('canManageWork:user?.can_manage_work===true'));
    assert.ok(config.includes('if (flags.isClientPortal)'));
    assert.ok(config.includes('if (flags.isPartnerPortal)'));
    assert.ok(config.includes('ACCOUNTANT_HREFS'));
    assert.ok(config.includes('"/dashboard/consolidation": "features.corporate_structure"'));
});

test("inventory and time navigation use their own effective capabilities",()=>{
 const provider=read("../components/dashboard/WorkspaceNavigationProvider.tsx");
 const config=read("../components/dashboard/sidebar-nav-config.tsx");
 assert.ok(provider.includes('canViewInventory:current?.permissions["inventory.read"]===true'));
 assert.ok(config.includes('flags.canViewInventory ?? flags.isAdminOrManager'));
 assert.ok(provider.includes('canApproveTime:current?.permissions["time.approve"]===true'));
 assert.ok(provider.includes('canReadTime:current?.permissions["time.read"]===true'));
});
