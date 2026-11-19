export type NavigationSection = "daily" | "business" | "administration";
export type NavigationGroupSpec = {
    id: string;
    label: { es: string; en: string };
    section: NavigationSection;
    hrefs: readonly string[];
};

export const NAVIGATION_SECTIONS = {
    daily: { es: "Operación diaria", en: "Daily operations" },
    business: { es: "Gestión y resultados", en: "Business and results" },
    administration: { es: "Administración", en: "Administration" },
} as const;

/** One location for each destination, in the order people use the product. */
export const WORKSPACE_NAVIGATION: readonly NavigationGroupSpec[] = [
    { id: "home", label: { es: "Inicio", en: "Home" }, section: "daily", hrefs: ["/dashboard", "/dashboard/alertas", "/dashboard/mi-jornada"] },
    { id: "planning", label: { es: "Planificación", en: "Planning" }, section: "daily", hrefs: ["/dashboard/planificar", "/dashboard/calendar", "/dashboard/plantilla/turnos", "/dashboard/work-orders", "/dashboard/reservations"] },
    { id: "operations", label: { es: "Trabajos", en: "Work" }, section: "daily", hrefs: ["/dashboard/tasks", "/dashboard/control-servicio", "/dashboard/task-reports", "/dashboard/offline-review", "/dashboard/handover", "/dashboard/additional-work"] },
    { id: "clients", label: { es: "Clientes y centros", en: "Clients and sites" }, section: "daily", hrefs: ["/dashboard/clients", "/dashboard/locations", "/dashboard/contracts"] },
    { id: "staff", label: { es: "Personal", en: "People" }, section: "daily", hrefs: ["/dashboard/plantilla/trabajadores", "/dashboard/plantilla/equipos", "/dashboard/plantilla/ausencias", "/dashboard/plantilla/documentacion", "/dashboard/plantilla/solicitudes", "/dashboard/live-work", "/dashboard/time-corrections"] },
    { id: "commercial", label: { es: "Comercial", en: "Sales" }, section: "business", hrefs: ["/dashboard/commercial", "/dashboard/services", "/dashboard/calculator", "/dashboard/quotes"] },
    { id: "resources", label: { es: "Compras y recursos", en: "Purchasing and resources" }, section: "business", hrefs: ["/dashboard/inventory", "/dashboard/expenses", "/dashboard/subcontracts", "/dashboard/external-network", "/dashboard/assets", "/dashboard/resources"] },
    { id: "billing", label: { es: "Finanzas", en: "Finance" }, section: "business", hrefs: ["/dashboard/invoices", "/dashboard/currencies", "/dashboard/invoice-summary", "/dashboard/labor-costs", "/dashboard/advisory", "/dashboard/fiscal-calendar", "/dashboard/fiscal-summary"] },
    { id: "quality", label: { es: "Calidad", en: "Quality" }, section: "business", hrefs: ["/dashboard/quality"] },
    { id: "reports", label: { es: "Análisis e informes", en: "Insights and reports" }, section: "business", hrefs: ["/dashboard/management", "/dashboard/analytics", "/dashboard/custom-reports", "/dashboard/consolidation"] },
    { id: "documents", label: { es: "Documentación", en: "Documents" }, section: "administration", hrefs: ["/dashboard/documents"] },
    { id: "applications", label: { es: "Portales y aplicaciones", en: "Portals and apps" }, section: "administration", hrefs: ["/dashboard/portals"] },
    { id: "organization", label: { es: "Organización y ajustes", en: "Organization and settings" }, section: "administration", hrefs: ["/dashboard/organization", "/dashboard/automations", "/dashboard/data-import", "/dashboard/api-access"] },
    { id: "platform", label: { es: "Plataforma WorkHive", en: "WorkHive platform" }, section: "administration", hrefs: ["/dashboard/companies", "/dashboard/integrations", "/dashboard/roles", "/dashboard/traffic"] },
];

export function navigationFeatureEnabled(enabled: ReadonlySet<string> | null | undefined, requirement?: string | readonly string[]): boolean {
    if (enabled == null || requirement == null) return true;
    return typeof requirement === "string" ? enabled.has(requirement) : requirement.some(feature => enabled.has(feature));
}

export function navigationGroupForPath(pathname: string): NavigationGroupSpec | undefined {
    let matching: NavigationGroupSpec | undefined;
    let length = -1;
    for (const group of WORKSPACE_NAVIGATION) for (const href of group.hrefs) {
        if ((pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"))) && href.length > length) {
            matching = group;
            length = href.length;
        }
    }
    return matching;
}
