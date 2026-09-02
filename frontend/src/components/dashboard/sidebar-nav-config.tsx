import type { CSSProperties, ReactNode } from "react";
import { CalendarDays, CloudCog, FileText, LineChart, Network, ShieldAlert } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";

export type NavLink = {
    href: string;
    label: string;
    exact: boolean;
    icon: ReactNode;
};

export type NavGroup = {
    id: string;
    label: string;
    icon: ReactNode;
    children: NavLink[];
};

export const SIDEBAR_LOGO_STYLE: CSSProperties = {
    filter: "var(--logo-filter)",
};

export const ORDERED_PLAIN_HREFS = [
    "/dashboard",
    "/dashboard/calendar",
    "/dashboard/tasks",
    "/dashboard/task-reports",
    "/dashboard/live-work",
    "/dashboard/reservations",
    "/dashboard/locations",
    "/dashboard/users",
    "/dashboard/organization",
    "/dashboard/companies",
    "/dashboard/integrations",
    "/dashboard/roles",
    "/dashboard/traffic",
];

const PLATFORM_SUPERADMIN_HREFS = new Set([
    "/dashboard",
    "/dashboard/companies",
    "/dashboard/roles",
    "/dashboard/traffic",
    "/dashboard/users",
    "/dashboard/integrations",
]);
const ACCOUNTANT_HREFS = new Set([
    "/dashboard/analytics",
    "/dashboard/fiscal-summary",
]);

export type SidebarNavUserFlags = {
    isAdminOrManager: boolean;
    isCompanyAdmin: boolean;
    canViewFinance: boolean;
    isAccountant: boolean;
    userIsPlatformSuperadmin: boolean;
    enabledFeatures?: ReadonlySet<string> | null;
};

const NAVIGATION_FEATURES: Record<string, string> = {
    "/dashboard/clients": "features.clients",
    "/dashboard/locations": "features.locations",
    "/dashboard/tasks": "features.work_orders",
    "/dashboard/live-work": "features.time_tracking",
    "/dashboard/reservations": "features.planning",
    "/dashboard/organization": "features.organization",
    "/dashboard/quotes": "features.quotes",
    "/dashboard/invoices": "features.invoices",
};

function buildNavLinks(
    dict: Dictionary,
    isAdminOrManager: boolean,
    isCompanyAdmin: boolean,
    canViewFinance: boolean,
    userIsPlatformSuperadmin: boolean,
): NavLink[] {
    return [
        {
            href: "/dashboard",
            label: dict.dashboard.overview,
            exact: true,
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            ),
        },
        ...(userIsPlatformSuperadmin
            ? [
                  {
                      href: "/dashboard/companies",
                      label: dict.dashboard.companies,
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                      ),
                  },
                  {
                      href: "/dashboard/integrations",
                      label: dict.dashboard.integrations,
                      exact: false,
                      icon: <CloudCog className="h-5 w-5 flex-shrink-0" />,
                  },
                  {
                      href: "/dashboard/roles",
                      label: dict.dashboard.roles,
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                      ),
                  },
                  {
                      href: "/dashboard/traffic",
                      label: dict.dashboard.traffic,
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h3l2-6 4 12 3-8 2 2h4" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h16" />
                          </svg>
                      ),
                  },
              ]
            : []),
        ...(isAdminOrManager
            ? [
                  {
                      href: "/dashboard/task-reports",
                      label: dict.task_reports.nav_label,
                      exact: false,
                      icon: <ShieldAlert className="h-5 w-5 flex-shrink-0" />,
                  },
                  {
                      href: "/dashboard/users",
                      label: dict.users.title,
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                      ),
                  },
                  {
                      href: "/dashboard/live-work",
                      label: dict.dashboard.live_work || "Fichajes en vivo",
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 5.5l1-1M5.5 5.5l-1-1" />
                          </svg>
                      ),
                  },
              ]
            : []),
        {
            href: "/dashboard/clients",
            label: dict.dashboard.clients,
            exact: false,
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
        },
        {
            href: "/dashboard/locations",
            label: dict.dashboard.locations,
            exact: false,
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
        ...(isAdminOrManager
            ? [
                  {
                      href: "/dashboard/reservations",
                      label: dict.dashboard.reservations || "Reservas",
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15a2 2 0 114 0 2 2 0 01-4 0zm4 0h5m-2 0v2" />
                          </svg>
                      ),
                  },
              ]
            : []),
        {
            href: "/dashboard/tasks",
            label: dict.dashboard.tasks,
            exact: false,
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            ),
        },
        {
            href: "/dashboard/calendar",
            label: dict.dashboard.calendar,
            exact: false,
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v13a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
                </svg>
            ),
        },
        ...(isCompanyAdmin
            ? [
                  {
                      href: "/dashboard/organization",
                      label: "Organización",
                      exact: false,
                      icon: <Network className="h-5 w-5 flex-shrink-0" />,
                  },
                  {
                      href: "/dashboard/quotes",
                      label: dict.quotes?.nav_label ?? "Presupuestos",
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                      ),
                  },
              ]
            : []),
        ...(canViewFinance
            ? [
                  {
                      href: "/dashboard/invoices",
                      label: dict.dashboard.invoices,
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
                              <path d="M16 8H8" />
                              <path d="M16 12H8" />
                              <path d="M13 16H8" />
                          </svg>
                      ),
                  },
                  {
                      href: "/dashboard/invoice-summary",
                      label: dict.invoices.summary_nav,
                      exact: false,
                      icon: <LineChart className="h-5 w-5 flex-shrink-0" />,
                  },
                  {
                      href: "/dashboard/expenses",
                      label: dict.expenses.title,
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M8 7h8" />
                              <path d="M8 11h8" />
                              <path d="M8 15h5" />
                              <path d="M5 3h14a1 1 0 011 1v16l-3-2-3 2-3-2-3 2-3-2-3 2V4a1 1 0 011-1z" />
                          </svg>
                      ),
                  },
                  {
                      href: "/dashboard/analytics",
                      label: dict.finance_analytics.eyebrow,
                      exact: false,
                      icon: (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3v18h18" />
                              <path d="M7 15l4-4 3 3 5-7" />
                              <path d="M17 7h2v2" />
                          </svg>
                      ),
                  },
                  {
                      href: "/dashboard/fiscal-summary",
                      label: dict.fiscal_summary.nav_label,
                      exact: false,
                      icon: <FileText className="h-5 w-5 flex-shrink-0" />,
                  },
                  {
                      href: "/dashboard/fiscal-calendar",
                      label: dict.fiscal_calendar.title,
                      exact: false,
                      icon: <CalendarDays className="h-5 w-5 flex-shrink-0" />,
                  },
              ]
            : []),
    ];
}

export function buildSidebarNavLinks(dict: Dictionary, flags: SidebarNavUserFlags) {
    const navLinks = buildNavLinks(
        dict,
        flags.isAdminOrManager,
        flags.isCompanyAdmin,
        flags.canViewFinance,
        flags.userIsPlatformSuperadmin,
    );

    const roleVisibleNavLinks = flags.userIsPlatformSuperadmin
        ? navLinks.filter(link => PLATFORM_SUPERADMIN_HREFS.has(link.href))
        : flags.isAccountant
            ? navLinks.filter(link => ACCOUNTANT_HREFS.has(link.href))
            : navLinks;

    const enabledFeatures = flags.enabledFeatures;
    const visibleNavLinks = enabledFeatures == null || flags.userIsPlatformSuperadmin || flags.isAccountant
        ? roleVisibleNavLinks
        : roleVisibleNavLinks.filter((link) => {
            const feature = NAVIGATION_FEATURES[link.href];
            return !feature || enabledFeatures.has(feature);
        });

    const linkByHref = new Map(visibleNavLinks.map(link => [link.href, link]));
    const buildGroup = (
        id: string,
        label: string,
        icon: ReactNode,
        hrefs: string[],
    ): NavGroup | null => {
        const children = hrefs.flatMap(href => {
            const link = linkByHref.get(href);
            return link ? [link] : [];
        });
        return children.length ? { id, label, icon, children } : null;
    };

    const navGroups = [
        buildGroup("sales", dict.sidebar_groups.sales, (
            <FileText className="h-5 w-5 flex-shrink-0" />
        ), ["/dashboard/invoices", "/dashboard/invoice-summary", "/dashboard/clients", "/dashboard/quotes"]),
        buildGroup("finance", dict.sidebar_groups.finance, (
            <LineChart className="h-5 w-5 flex-shrink-0" />
        ), [
            "/dashboard/expenses",
            "/dashboard/analytics",
            "/dashboard/fiscal-summary",
            "/dashboard/fiscal-calendar",
        ]),
    ].filter(Boolean) as NavGroup[];

    const groupedLinkHrefs = new Set(navGroups.flatMap(group => group.children.map(link => link.href)));
    const plainLinkMap = new Map(
        visibleNavLinks.flatMap(link =>
            groupedLinkHrefs.has(link.href) ? [] : [[link.href, link] as const],
        ),
    );
    const plainLinks = [
        ...ORDERED_PLAIN_HREFS.flatMap(href => {
            const link = plainLinkMap.get(href);
            return link ? [link] : [];
        }),
        ...visibleNavLinks.filter(link => !groupedLinkHrefs.has(link.href) && !ORDERED_PLAIN_HREFS.includes(link.href)),
    ] as NavLink[];

    return { navLinks, visibleNavLinks, navGroups, plainLinks };
}
