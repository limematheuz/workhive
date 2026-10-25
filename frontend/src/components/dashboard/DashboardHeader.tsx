"use client";

import { usePathname } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationPanel } from "./notifications/NotificationPanel";

export function DashboardHeader() {
    const { dict } = useDictionary();
    const pathname = usePathname();
    const pageTitle = pathname === "/dashboard" ? dict.dashboard.overview
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
        : pathname.includes("/dashboard/calendar") ? dict.dashboard.calendar
        : pathname.includes("/dashboard/integrations") ? dict.dashboard.integrations
        : pathname.includes("/dashboard/api-access") ? "Acceso API"
        : pathname.includes("/dashboard/external-network") ? dict.external_network.title
        : pathname.includes("/dashboard/external-access") ? dict.organization.external_access.title
        : pathname.includes("/dashboard/organization") ? dict.organization.title
        : pathname.includes("/dashboard/collaborations") ? dict.collaborations.title
        : pathname.includes("/dashboard/clients") ? dict.dashboard.clients
        : pathname.includes("/dashboard/contracts") ? "Contratos"
        : pathname.includes("/dashboard/locations") ? dict.dashboard.locations
        : pathname.includes("/dashboard/work-orders") ? "Órdenes de trabajo"
        : pathname.includes("/dashboard/tasks") ? dict.dashboard.tasks
        : pathname.includes("/dashboard/invoice-summary") ? dict.invoices.summary_nav
        : pathname.includes("/dashboard/invoices") ? dict.dashboard.invoices
        : pathname.includes("/dashboard/companies") ? dict.dashboard.companies
        : pathname.includes("/dashboard/roles") ? dict.dashboard.roles
        : dict.dashboard.overview;
    return <header className="relative z-[var(--z-header)] flex h-20 min-w-0 items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-transparent px-[max(3%,env(safe-area-inset-left))] pr-[max(3%,env(safe-area-inset-right))] transition-colors duration-300 md:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4"><SidebarTrigger /><h1 className="min-w-0 truncate text-lg font-semibold text-[var(--text-main)] sm:text-xl">{pageTitle}</h1></div>
        <div className="flex shrink-0 items-center"><NotificationPanel /></div>
    </header>;
}
