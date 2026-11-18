import type { CSSProperties, ReactNode } from "react";
import { UsersRound, Activity, CalendarClock, ClipboardPenLine, FileSignature, House, ShieldCheck, Timer, BarChart3, Boxes, Building2, CalendarDays, CircleDollarSign, ClipboardCheck, ClipboardList, CloudCog, FileChartColumn, FileText, Gauge, KeyRound, Landmark, MapPin, Network, ReceiptText, ShieldAlert, UserRound, WalletCards, Workflow, Target, PackageSearch, Settings2, FolderOpen, ChartNoAxesCombined, Calculator, CalendarPlus, PanelsTopLeft, Wrench, Truck, Handshake, Repeat2, Upload } from "lucide-react";
import { WORKSPACE_NAVIGATION, NAVIGATION_SECTIONS, navigationFeatureEnabled, type NavigationSection } from "@/domain/navigation/workspace-navigation";
import type { Dictionary } from "@/lib/dictionary-context";

export type NavLink = { href: string; label: string; exact: boolean; icon: ReactNode };
export type NavGroup = { id: string; label: string; icon: ReactNode; section: NavigationSection; sectionLabel: string; children: NavLink[] };
export const SIDEBAR_LOGO_STYLE: CSSProperties = { filter: "var(--logo-filter)" };

export type SidebarNavUserFlags = {
    isAdminOrManager: boolean;
    isCompanyAdmin: boolean;
    canReadClients: boolean;
    canReadCommercial?: boolean;
    canManageTime: boolean;
    canManageWork?: boolean;
    canViewInventory?: boolean;
    canReadTime?: boolean;
    canApproveTime?: boolean;
    canViewWorkReports: boolean;
    canViewOrganization?: boolean;
    canViewFinance: boolean;
    canViewLaborCosts: boolean;
    canViewQuality: boolean;
    isAccountant: boolean;
    isPartnerPortal: boolean;
    isClientPortal: boolean;
    userIsPlatformSuperadmin: boolean;
    enabledFeatures?: ReadonlySet<string> | null;
};

const PLATFORM_SUPERADMIN_HREFS = new Set(["/dashboard", "/dashboard/companies", "/dashboard/roles", "/dashboard/traffic", "/dashboard/integrations"]);
const ACCOUNTANT_HREFS = new Set(["/dashboard/advisory", "/dashboard/analytics", "/dashboard/expenses", "/dashboard/fiscal-summary"]);
const NAVIGATION_FEATURES: Record<string, string | readonly string[]> = {
    "/dashboard/consolidation": "features.corporate_structure",
    "/dashboard/currencies":"features.invoices",
    "/dashboard/plantilla/trabajadores":"features.hr", "/dashboard/plantilla/equipos":"features.hr", "/dashboard/plantilla/ausencias":"features.hr", "/dashboard/plantilla/documentacion":"features.hr", "/dashboard/plantilla/solicitudes":["features.hr","features.inventory"],
    "/dashboard/planificar": "features.work_orders", "/dashboard/services": "features.work_orders", "/dashboard/commercial": "features.clients", "/dashboard/calculator": "features.quotes", "/dashboard/management": "features.profitability", "/dashboard/portals": ["features.client_portal", "features.accountant_portal", "features.work_orders"],
    "/dashboard/clients": "features.clients", "/dashboard/locations": "features.locations", "/dashboard/documents": ["features.locations","features.clients","features.hr"], "/dashboard/assets": "features.locations", "/dashboard/subcontracts":"features.inventory", "/dashboard/resources": "features.inventory", "/dashboard/inventory": "features.inventory", "/dashboard/additional-work": "features.work_orders", "/dashboard/tasks": "features.work_orders", "/dashboard/alertas": "features.work_orders", "/dashboard/work-orders": "features.work_orders", "/dashboard/live-work": "features.time_tracking", "/dashboard/time-corrections": "features.time_tracking", "/dashboard/control-servicio": "features.time_tracking", "/dashboard/mi-jornada":"features.time_tracking", "/dashboard/offline-review":"features.time_tracking", "/dashboard/plantilla/turnos":"features.work_orders", "/dashboard/advisory":"features.accountant_portal", "/dashboard/reservations": "features.planning", "/dashboard/organization": "features.organization", "/dashboard/api-access": "features.api", "/dashboard/quotes": "features.quotes", "/dashboard/contracts": "features.quotes", "/dashboard/invoices": "features.invoices", "/dashboard/quality": "features.quality",
};

function allLinks(dict: Dictionary, flags: SidebarNavUserFlags, locale: "es" | "en"): NavLink[] {
    const text = (es: string, en: string) => locale === "en" ? en : es;
    return [
        ...(flags.canViewFinance&&!flags.isAccountant?[{href:"/dashboard/currencies",label:text("Operaciones en divisas","Currency transactions"),exact:true,icon:<CircleDollarSign/>}]:[]),
        { href: "/dashboard", label: dict.dashboard.overview, exact: true, icon: <House /> },
        {href: "/dashboard/plantilla/solicitudes",label:"Solicitudes internas",exact:true,icon:<ClipboardPenLine />},
        {href: "/dashboard/plantilla/documentacion", label: "Documentación y formación", exact: true, icon:<FileText />},
        { href: "/dashboard/mi-jornada", label: "Mi jornada sin conexión", exact: true, icon: <ClipboardPenLine /> },
        { href: "/dashboard/calendar", label: dict.dashboard.calendar, exact: false, icon: <CalendarDays /> },
        { href: "/dashboard/tasks", label: dict.dashboard.tasks, exact: false, icon: <ClipboardList /> },
        { href: "/dashboard/work-orders", label: text("Programaciones recurrentes", "Recurring schedules"), exact: false, icon: <Repeat2 /> },
        { href: "/dashboard/locations", label: dict.dashboard.locations, exact: false, icon: <MapPin /> },
        { href: "/dashboard/documents", label: "Documentos", exact: false, icon: <FileText /> },
        { href: "/dashboard/assets", label: text("Maquinaria y material", "Equipment and materials"), exact: false, icon: <Wrench /> },
        ...((flags.canViewInventory ?? flags.isAdminOrManager) ? [{ href: "/dashboard/resources", label: "Vehículos y entregas", exact: true, icon: <Truck /> }, { href: "/dashboard/inventory", label: "Inventario", exact: false, icon: <Boxes /> }] : []),
        ...((flags.canManageTime || flags.canReadTime || flags.canApproveTime) ? [{ href: "/dashboard/control-servicio", label: "Control del servicio", exact: true, icon: <Timer /> }, { href: "/dashboard/time-corrections", label: "Fichajes", exact: false, icon: <Timer /> }] : []),
        ...(flags.canApproveTime ? [{href:"/dashboard/offline-review",label:"Partes sin conexión",exact:true,icon:<ClipboardCheck/>}] : []),
        ...(flags.canReadTime ? [{href:"/dashboard/live-work",label:dict.dashboard.live_work||"Fichajes en vivo",exact:false,icon:<Activity/>}] : []),
        ...(flags.isAccountant || flags.canViewFinance || flags.canViewLaborCosts ? [{href:"/dashboard/advisory",label:"Portal de gestoría",exact:true,icon:<Landmark />}]:[]),
        ...(flags.isAdminOrManager ? [
            { href: "/dashboard/planificar", label: text("Planificar trabajo", "Plan work"), exact: true, icon: <CalendarPlus /> },
        ...(flags.canViewFinance ? [{href: "/dashboard/additional-work", label: "Trabajos adicionales", exact: true, icon: <ClipboardPenLine />}]: []),
            { href: "/dashboard/alertas", label: "Pendientes y alertas", exact: true, icon: <ShieldAlert /> },
            { href: "/dashboard/reservations", label: dict.dashboard.reservations || "Planificación", exact: false, icon: <CalendarClock /> },
            { href: "/dashboard/external-network", label: dict.external_network.title, exact: false, icon: <Network /> },
        ] : []),
        ...(flags.canViewWorkReports ? [
            {href:"/dashboard/handover",label:"Traspaso entre turnos",exact:true,icon:<ClipboardPenLine />},
            { href: "/dashboard/task-reports", label: dict.task_reports.nav_label, exact: false, icon: <ClipboardCheck /> },
        ] : []),
        ...(flags.canViewQuality ? [
            { href: "/dashboard/quality", label: "Calidad", exact: false, icon: <ShieldCheck /> },
        ] : []),
        ...(flags.isAdminOrManager ? [{href:"/dashboard/custom-reports",label:"Informes personalizados",exact:true,icon:<FileChartColumn />}]:[]),
        ...((flags.canViewInventory ?? flags.isAdminOrManager) && flags.canViewFinance ? [{href:"/dashboard/subcontracts",label:"Subcontratas",exact:true,icon:<Handshake />}]:[]),
        ...(flags.canReadCommercial ? [{ href: "/dashboard/commercial", label: text("Leads y oportunidades", "Leads and opportunities"), exact: true, icon: <Target /> }] : []),
        ...(flags.canManageWork ? [{ href: "/dashboard/services", label: text("Servicios y tarifas", "Services and rates"), exact: true, icon: <ClipboardList /> }] : []),
        ...(flags.canViewFinance && flags.canViewLaborCosts ? [
            { href: "/dashboard/calculator", label: text("Calculadora de presupuestos", "Quote calculator"), exact: true, icon: <Calculator /> },
            { href: "/dashboard/management", label: text("Indicadores de empresa", "Company performance"), exact: true, icon: <ChartNoAxesCombined /> },
        ] : []),
        ...(flags.isCompanyAdmin ? [{ href: "/dashboard/portals", label: text("Portales y aplicaciones", "Portals and apps"), exact: true, icon: <PanelsTopLeft /> }] : []),
        ...(flags.canReadClients ? [{ href: "/dashboard/clients", label: dict.dashboard.clients, exact: false, icon: <Building2 /> }] : []),
        ...(flags.isCompanyAdmin || flags.canViewOrganization ? [
            {href:"/dashboard/automations",label:"Automatizaciones",exact:true,icon:<Workflow />},
            {href:"/dashboard/data-import",label:"Importar datos",exact:true,icon:<Upload />},
            { href: "/dashboard/organization", label: dict.organization.nav_label, exact: false, icon: <Network /> },
        ] : []),
        ...(flags.isCompanyAdmin && flags.enabledFeatures?.has("features.api") ? [
            { href: "/dashboard/api-access", label: "Acceso API", exact: false, icon: <KeyRound /> },
        ] : []),
        ...(flags.canViewFinance ? [
            {href: "/dashboard/consolidation", label: "Sociedades y consolidación", exact: true, icon:<Network />},
            { href: "/dashboard/quotes", label: dict.quotes?.nav_label ?? "Presupuestos", exact: false, icon: <FileText /> },
            { href: "/dashboard/contracts", label: "Contratos", exact: false, icon: <FileSignature /> },
            { href: "/dashboard/invoices", label: dict.dashboard.invoices, exact: false, icon: <ReceiptText /> },
            { href: "/dashboard/invoice-summary", label: dict.invoices.summary_nav, exact: false, icon: <FileChartColumn /> },
            { href: "/dashboard/expenses", label: dict.expenses.title, exact: false, icon: <WalletCards /> },
            { href: "/dashboard/analytics", label: text("Rentabilidad", "Profitability"), exact: false, icon: <BarChart3 /> },
            { href: "/dashboard/fiscal-summary", label: dict.fiscal_summary.nav_label, exact: false, icon: <Landmark /> },
            { href: "/dashboard/fiscal-calendar", label: dict.fiscal_calendar.title, exact: false, icon: <CalendarDays /> },
        ] : []),
        ...(flags.canViewLaborCosts ? [
            { href: "/dashboard/plantilla/turnos", label: "Turnos y cobertura", exact: true, icon: <CalendarClock /> },
            { href: "/dashboard/plantilla/trabajadores", label: "Trabajadores", exact: true, icon: <UserRound /> },
            { href: "/dashboard/plantilla/equipos", label: "Equipos de trabajo", exact: true, icon: <UsersRound /> },
            { href: "/dashboard/plantilla/ausencias", label: "Ausencias y sustituciones", exact: true, icon: <CalendarClock /> },
            { href: "/dashboard/labor-costs", label: "Costes laborales", exact: false, icon: <CircleDollarSign /> },
        ] : []),
        ...(flags.userIsPlatformSuperadmin ? [
            { href: "/dashboard/companies", label: dict.dashboard.companies, exact: false, icon: <Building2 /> },
            { href: "/dashboard/integrations", label: dict.dashboard.integrations, exact: false, icon: <CloudCog /> },
            { href: "/dashboard/roles", label: dict.dashboard.roles, exact: false, icon: <ShieldAlert /> },
            { href: "/dashboard/traffic", label: dict.traffic?.title || "Tráfico", exact: false, icon: <Gauge /> },
        ] : []),
    ];
}

export function buildSidebarNavLinks(dict: Dictionary, flags: SidebarNavUserFlags, locale: "es" | "en" = "es") {
    if (flags.isClientPortal) {
        const clientLinks: NavLink[] = [
            { href: "/dashboard/client", label: "Documentos", exact: true, icon: <FileText /> },
            { href: "/dashboard/client/profile", label: "Perfil", exact: false, icon: <UserRound /> },
        ];
        return {
            navLinks: clientLinks,
            visibleNavLinks: clientLinks,
            navGroups: [],
            plainLinks: clientLinks,
        };
    }
    if (flags.isPartnerPortal) {
        const partnerLinks: NavLink[] = [
            { href: "/dashboard/partner", label: "Resumen", exact: true, icon: <Gauge /> },
            { href: "/dashboard/partner/properties", label: "Propiedades", exact: false, icon: <MapPin /> },
            { href: "/dashboard/partner/requests", label: "Solicitudes", exact: false, icon: <ClipboardList /> },
            { href: "/dashboard/partner/profile", label: "Perfil", exact: false, icon: <UserRound /> },
        ];
        return {
            navLinks: partnerLinks,
            visibleNavLinks: partnerLinks,
            navGroups: [],
            plainLinks: partnerLinks,
        };
    }
    const all = allLinks(dict, flags, locale);
    const linksForRole = flags.userIsPlatformSuperadmin ? all.filter(link => PLATFORM_SUPERADMIN_HREFS.has(link.href)) : flags.isAccountant ? all.filter(link => ACCOUNTANT_HREFS.has(link.href)) : all;
    const visibleNavLinks = flags.enabledFeatures == null || flags.userIsPlatformSuperadmin || flags.isAccountant ? linksForRole : linksForRole.filter(link => navigationFeatureEnabled(flags.enabledFeatures, NAVIGATION_FEATURES[link.href]));
    const byHref = new Map(visibleNavLinks.map(link => [link.href, link]));
    const groupIcons: Record<string, ReactNode> = {
        home: <House />, planning: <CalendarClock />, operations: <ClipboardCheck />,
        clients: <Building2 />, staff: <UsersRound />, commercial: <Target />,
        resources: <PackageSearch />, billing: <WalletCards />, quality: <ShieldCheck />,
        reports: <ChartNoAxesCombined />, documents: <FolderOpen />, applications: <PanelsTopLeft />, organization: <Settings2 />, platform: <CloudCog />,
    };
    const navGroups: NavGroup[] = WORKSPACE_NAVIGATION.flatMap(group => {
        const children = group.hrefs.flatMap(href => {
            const link = byHref.get(href);
            return link ? [link] : [];
        });
        return children.length ? [{
            id: group.id, label: group.label[locale], icon: groupIcons[group.id],
            section: group.section, sectionLabel: NAVIGATION_SECTIONS[group.section][locale], children,
        }] : [];
    });
    const grouped = new Set(navGroups.flatMap(item => item.children.map(link => link.href)));
    return { navLinks: linksForRole, visibleNavLinks, navGroups, plainLinks: visibleNavLinks.filter(link => !grouped.has(link.href)) };
}
