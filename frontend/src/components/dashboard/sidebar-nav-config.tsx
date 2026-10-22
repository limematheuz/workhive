import type { CSSProperties, ReactNode } from "react";
import { BarChart3, Boxes, Building2, CalendarDays, CircleDollarSign, ClipboardCheck, ClipboardList, CloudCog, FileChartColumn, FileText, Gauge, KeyRound, Landmark, MapPin, Network, PackagePlus, ReceiptText, Repeat2, ShieldAlert, Sparkles, UserRound, WalletCards, Workflow } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";

export type NavLink = { href: string; label: string; exact: boolean; icon: ReactNode };
export type NavGroup = { id: string; label: string; icon: ReactNode; children: NavLink[] };
export const SIDEBAR_LOGO_STYLE: CSSProperties = { filter: "var(--logo-filter)" };

export type SidebarNavUserFlags = {
    isAdminOrManager: boolean;
    isCompanyAdmin: boolean;
    canManageTime: boolean;
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
const ACCOUNTANT_HREFS = new Set(["/dashboard/analytics", "/dashboard/expenses", "/dashboard/fiscal-summary"]);
const NAVIGATION_FEATURES: Record<string, string> = {
    "/dashboard/clients": "features.clients", "/dashboard/locations": "features.locations", "/dashboard/documents": "features.locations", "/dashboard/assets": "features.locations", "/dashboard/inventory": "features.inventory", "/dashboard/tasks": "features.work_orders", "/dashboard/work-orders": "features.work_orders", "/dashboard/live-work": "features.time_tracking", "/dashboard/time-corrections": "features.time_tracking", "/dashboard/reservations": "features.planning", "/dashboard/organization": "features.organization", "/dashboard/api-access": "features.api", "/dashboard/quotes": "features.quotes", "/dashboard/contracts": "features.quotes", "/dashboard/invoices": "features.invoices", "/dashboard/quality": "features.quality",
};

function allLinks(dict: Dictionary, flags: SidebarNavUserFlags): NavLink[] {
    return [
        { href: "/dashboard", label: dict.dashboard.overview, exact: true, icon: <Gauge /> },
        { href: "/dashboard/calendar", label: dict.dashboard.calendar, exact: false, icon: <CalendarDays /> },
        { href: "/dashboard/tasks", label: dict.dashboard.tasks, exact: false, icon: <ClipboardList /> },
        { href: "/dashboard/work-orders", label: "Órdenes", exact: false, icon: <Repeat2 /> },
        { href: "/dashboard/locations", label: dict.dashboard.locations, exact: false, icon: <MapPin /> },
        { href: "/dashboard/documents", label: "Documentos", exact: false, icon: <FileText /> },
        { href: "/dashboard/assets", label: "Activos", exact: false, icon: <PackagePlus /> },
        ...(flags.isAdminOrManager ? [{ href: "/dashboard/inventory", label: "Inventario", exact: false, icon: <Boxes /> }] : []),
        ...(flags.canManageTime ? [{ href: "/dashboard/time-corrections", label: "Fichajes", exact: false, icon: <ClipboardCheck /> }] : []),
        ...(flags.isAdminOrManager ? [
            { href: "/dashboard/reservations", label: dict.dashboard.reservations || "Planificación", exact: false, icon: <Workflow /> },
            { href: "/dashboard/live-work", label: dict.dashboard.live_work || "Fichajes en vivo", exact: false, icon: <Workflow /> },
            { href: "/dashboard/external-network", label: dict.external_network.title, exact: false, icon: <Network /> },
        ] : []),
        ...(flags.canViewWorkReports ? [
            { href: "/dashboard/task-reports", label: dict.task_reports.nav_label, exact: false, icon: <ShieldAlert /> },
        ] : []),
        ...(flags.canViewQuality ? [
            { href: "/dashboard/quality", label: "Calidad", exact: false, icon: <Sparkles /> },
        ] : []),
        { href: "/dashboard/clients", label: dict.dashboard.clients, exact: false, icon: <Building2 /> },
        ...(flags.isCompanyAdmin || flags.canViewOrganization ? [
            { href: "/dashboard/organization", label: dict.organization.nav_label, exact: false, icon: <Network /> },
        ] : []),
        ...(flags.isCompanyAdmin && flags.enabledFeatures?.has("features.api") ? [
            { href: "/dashboard/api-access", label: "Acceso API", exact: false, icon: <KeyRound /> },
        ] : []),
        ...(flags.canViewFinance ? [
            { href: "/dashboard/quotes", label: dict.quotes?.nav_label ?? "Presupuestos", exact: false, icon: <FileText /> },
            { href: "/dashboard/contracts", label: "Contratos", exact: false, icon: <FileText /> },
            { href: "/dashboard/invoices", label: dict.dashboard.invoices, exact: false, icon: <ReceiptText /> },
            { href: "/dashboard/invoice-summary", label: dict.invoices.summary_nav, exact: false, icon: <FileChartColumn /> },
            { href: "/dashboard/expenses", label: dict.expenses.title, exact: false, icon: <WalletCards /> },
            { href: "/dashboard/analytics", label: dict.finance_analytics.eyebrow, exact: false, icon: <BarChart3 /> },
            { href: "/dashboard/fiscal-summary", label: dict.fiscal_summary.nav_label, exact: false, icon: <Landmark /> },
            { href: "/dashboard/fiscal-calendar", label: dict.fiscal_calendar.title, exact: false, icon: <CalendarDays /> },
        ] : []),
        ...(flags.canViewLaborCosts ? [
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

export function buildSidebarNavLinks(dict: Dictionary, flags: SidebarNavUserFlags) {
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
    const all = allLinks(dict, flags);
    const linksForRole = flags.userIsPlatformSuperadmin ? all.filter(link => PLATFORM_SUPERADMIN_HREFS.has(link.href)) : flags.isAccountant ? all.filter(link => ACCOUNTANT_HREFS.has(link.href)) : all;
    const visibleNavLinks = flags.enabledFeatures == null || flags.userIsPlatformSuperadmin || flags.isAccountant ? linksForRole : linksForRole.filter(link => !NAVIGATION_FEATURES[link.href] || flags.enabledFeatures?.has(NAVIGATION_FEATURES[link.href]));
    const byHref = new Map(visibleNavLinks.map(link => [link.href, link]));
    const group = (id: string, label: string, icon: ReactNode, hrefs: string[]): NavGroup | null => {
        const children = hrefs.flatMap(href => byHref.get(href) ? [byHref.get(href)!] : []);
        return children.length ? { id, label, icon, children } : null;
    };
    const navGroups = [
        group("operations", "Operación", <Workflow />, ["/dashboard/calendar", "/dashboard/tasks", "/dashboard/work-orders", "/dashboard/locations", "/dashboard/documents", "/dashboard/assets", "/dashboard/inventory", "/dashboard/time-corrections", "/dashboard/reservations", "/dashboard/live-work", "/dashboard/task-reports", "/dashboard/quality", "/dashboard/external-network"]),
        group("clients", "Clientes", <Building2 />, ["/dashboard/clients", "/dashboard/quotes"]),
        group("billing", "Facturación", <ReceiptText />, ["/dashboard/contracts", "/dashboard/invoices", "/dashboard/invoice-summary", "/dashboard/expenses", "/dashboard/analytics", "/dashboard/fiscal-summary", "/dashboard/fiscal-calendar", "/dashboard/labor-costs"]),
        group("organization", dict.organization.nav_label, <Network />, ["/dashboard/organization", "/dashboard/api-access"]),
        group("platform", "Plataforma WorkHive", <CloudCog />, ["/dashboard/companies", "/dashboard/integrations", "/dashboard/roles", "/dashboard/traffic"]),
    ].filter(Boolean) as NavGroup[];
    const grouped = new Set(navGroups.flatMap(item => item.children.map(link => link.href)));
    return { navLinks: linksForRole, visibleNavLinks, navGroups, plainLinks: visibleNavLinks.filter(link => !grouped.has(link.href)) };
}
