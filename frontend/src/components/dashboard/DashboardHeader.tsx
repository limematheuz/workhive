"use client";
import { CompanySwitcher } from "./CompanySwitcher";

import { ChevronRight } from "lucide-react";
import { navigationGroupForPath } from "@/domain/navigation/workspace-navigation";
import { usePathname } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationPanel } from "./notifications/NotificationPanel";
import { ApplicationSwitchLink } from "@/components/applications/ApplicationSwitchLink";

const titles:Record<string,string>={
        "/dashboard/planificar":"Planificar trabajo",
        "/dashboard/calculator":"Calculadora de presupuestos",
        "/dashboard/management":"Indicadores de empresa",
        "/dashboard/commercial":"Leads y oportunidades",
        "/dashboard/portals":"Portales externos",
        "/dashboard/custom-reports":"Informes personalizados",
        "/dashboard/subcontracts":"Subcontratas",
        "/dashboard/handover":"Traspaso entre turnos",
        "/dashboard/additional-work":"Trabajos adicionales",
        "/dashboard/advisory":"Portal de gestoría",
        "/dashboard/plantilla/turnos":"Turnos y cobertura",
        "/dashboard/plantilla/documentacion":"Documentación y formación",
        "/dashboard/plantilla/solicitudes":"Solicitudes internas",
        "/dashboard/mi-jornada":"Mi jornada sin conexión",
        "/dashboard/offline-review":"Partes sin conexión",
        "/dashboard/resources":"Vehículos y entregas",
        "/dashboard/consolidation":"Sociedades y consolidación",
        "/dashboard/data-import":"Importar datos",
        "/dashboard/automations":"Automatizaciones",
    };

const englishTitles: Record<string, string> = {
    "/dashboard/planificar": "Plan work", "/dashboard/calculator": "Quote calculator",
    "/dashboard/management": "Company performance", "/dashboard/commercial": "Leads and opportunities",
    "/dashboard/portals": "External portals", "/dashboard/custom-reports": "Custom reports",
    "/dashboard/subcontracts": "Subcontractors", "/dashboard/handover": "Shift handover",
    "/dashboard/additional-work": "Additional work", "/dashboard/advisory": "Adviser portal",
    "/dashboard/plantilla/turnos": "Shifts and coverage", "/dashboard/plantilla/documentacion": "Documents and training",
    "/dashboard/plantilla/solicitudes": "Internal requests", "/dashboard/mi-jornada": "My offline workday",
    "/dashboard/offline-review": "Offline work reports", "/dashboard/resources": "Vehicles and custody",
    "/dashboard/consolidation": "Companies and consolidation", "/dashboard/data-import": "Import data",
    "/dashboard/automations": "Automations",
};

export function DashboardHeader() {
    const { dict, locale } = useDictionary();
    const pathname = usePathname();
    const defaultPageTitle = pathname === "/dashboard" ? dict.dashboard.overview
        : (pathname === "/dashboard/client" || pathname.startsWith("/dashboard/client/")) ? "Portal de cliente"
        : pathname.includes("/dashboard/fiscal-summary") ? dict.fiscal_summary.title
        : pathname.includes("/dashboard/analytics") ? dict.finance_analytics.eyebrow
        : pathname.includes("/dashboard/fiscal-calendar") ? dict.fiscal_calendar.title
        : pathname.includes("/dashboard/labor-costs") ? "Costes laborales"
        : pathname.includes("/dashboard/expenses") ? dict.expenses.title
        : pathname.includes("/dashboard/traffic") ? (dict.traffic?.title || "Tráfico")
        : pathname.includes("/dashboard/profile") ? dict.dashboard.profile
        : pathname.includes("/dashboard/live-work") ? (dict.dashboard.live_work || "Fichajes en vivo")
        : pathname.includes("/dashboard/time-corrections") ? "Fichajes"
        : pathname.includes("/dashboard/reservations") ? dict.reservations.page_title
        : pathname.includes("/dashboard/calendar") ? dict.dashboard.calendar
        : pathname.includes("/dashboard/integrations") ? dict.dashboard.integrations
        : pathname.includes("/dashboard/api-access") ? "Acceso API"
        : pathname.includes("/dashboard/external-network") ? dict.external_network.title
        : pathname.includes("/dashboard/external-access") ? dict.organization.external_access.title
        : pathname.includes("/dashboard/organization") ? dict.organization.title
        : pathname.includes("/dashboard/collaborations") ? dict.collaborations.title
        : pathname.includes("/dashboard/clients") ? dict.dashboard.clients
        : pathname.includes("/dashboard/quotes") ? dict.quotes.nav_label
        : pathname.includes("/dashboard/contracts") ? "Contratos"
        : pathname.includes("/dashboard/locations") ? dict.dashboard.locations
        : (pathname === "/dashboard/documents" || pathname.startsWith("/dashboard/documents/")) ? dict.dashboard.documents
        : (pathname === "/dashboard/assets" || pathname.startsWith("/dashboard/assets/")) ? dict.dashboard.assets
        : (pathname === "/dashboard/quality" || pathname.startsWith("/dashboard/quality/")) ? "Calidad"
        : pathname === "/dashboard/control-servicio" ? "Control del servicio"
        : pathname === "/dashboard/alertas" ? "Pendientes y alertas"
        : pathname === "/dashboard/plantilla/ausencias" ? "Ausencias y sustituciones"
        : pathname === "/dashboard/plantilla/trabajadores" ? "Trabajadores"
        : pathname === "/dashboard/plantilla/equipos" ? "Equipos de trabajo"
        : pathname.includes("/dashboard/work-orders") ? "Órdenes de trabajo"
        : (pathname === "/dashboard/task-reports" || pathname.startsWith("/dashboard/task-reports/")) ? dict.task_reports.title
        : (pathname === "/dashboard/inventory" || pathname.startsWith("/dashboard/inventory/")) ? dict.inventoryNavigation.title
        : pathname.includes("/dashboard/tasks") ? dict.dashboard.tasks
        : pathname.includes("/dashboard/invoice-summary") ? dict.invoices.summary_nav
        : pathname.includes("/dashboard/invoices") ? dict.dashboard.invoices
        : pathname.includes("/dashboard/companies") ? dict.dashboard.companies
        : pathname.includes("/dashboard/roles") ? dict.dashboard.roles
        : dict.dashboard.overview;
    const pageTitle = (locale === "en" ? englishTitles[pathname] : titles[pathname]) ?? defaultPageTitle;
    const group = navigationGroupForPath(pathname);
    return <header className="relative z-[var(--z-header)] wh-dashboard-header flex h-14 shrink-0 min-w-0 items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-transparent px-[max(3%,env(safe-area-inset-left))] pr-[max(3%,env(safe-area-inset-right))] transition-colors duration-300 md:px-6">
        <div className="flex min-w-0 items-center gap-3"><SidebarTrigger /><nav aria-label={locale === "en" ? "Current location" : "Ubicación actual"} className="flex min-w-0 items-center gap-2 text-sm">
            {group && <><span className="hidden shrink-0 text-[var(--text-muted)] md:inline">{group.label[locale === "en" ? "en" : "es"]}</span><ChevronRight aria-hidden="true" className="hidden size-3.5 shrink-0 text-[var(--text-muted)] md:block" /></>}
            <span aria-current="page" className="min-w-0 truncate font-medium text-[var(--text-main)]">{pageTitle}</span>
        </nav></div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2"><ApplicationSwitchLink /><CompanySwitcher /><NotificationPanel /></div>
    </header>;
}
