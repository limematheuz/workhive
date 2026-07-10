import { AuditLog } from "@/types/audit-log";

export const TRAFFIC_PAGE_SIZE = 12;

export const fallbackTraffic = {
    es: {
        loading: "Cargando tráfico...",
        restricted_title: "Solo superadmin",
        restricted_desc: "Este panel solo está disponible para superadmins.",
        eyebrow: "Superadmin",
        title: "Tráfico y accesos",
        subtitle: "Logins registrados con usuario, empresa, IP, dispositivo y ubicación cuando el proxy la envía.",
        last_event: "Último acceso",
        total_accesses: "Accesos",
        last_24h: "Últimas 24 h",
        last_7d: "Últimos 7 días",
        unique_users: "Usuarios únicos",
        locations_seen: "Ubicaciones",
        map_title: "Mapa de accesos",
        map_subtitle: "Mapa 2D con ubicación aproximada por IP pública o proxy/CDN.",
        unknown_user: "Usuario desconocido",
        no_map_points: "Sin coordenadas todavía",
        no_map_points_desc: "En localhost puede no haber coordenadas. En producción se usa IP pública o headers del proxy/CDN.",
        active_locations: "Ubicaciones activas",
        reach_period: "Últimos 12 meses",
        search: "Buscar",
        summary: "Resumen",
        download: "Descargar",
        first_time_visits: "Primeras visitas",
        repeat_viewers: "Visitantes recurrentes",
        avg_engagement: "Tiempo medio",
        view_details: "Ver detalles",
        direct_organic: "Directo vs Orgánico",
        users_by_platform: "Usuarios por plataforma",
        activity_heatmap: "Mapa de actividad",
        month: "Mes",
        trend_title: "Tráfico semanal",
        trend_subtitle: "Logins por día.",
        table_title: "Accesos recientes",
        table_subtitle: "Usuarios que han iniciado sesión en la app.",
        tab_logins: "Logins",
        tab_url_only: "Solo URL",
        visitor: "Visitante",
        page: "URL",
        referrer: "Origen",
        user: "Usuario",
        company: "Empresa",
        location: "Ubicación",
        ip: "IP",
        device: "Dispositivo",
        time: "Hora",
        mobile: "Móvil",
        desktop: "Escritorio",
        browser: "Navegador",
        previous: "Anterior",
        next: "Siguiente",
        page_of: "Página {page} de {pages}",
        empty: "Todavía no hay accesos registrados. Los nuevos logins aparecerán aquí.",
    },
    en: {
        loading: "Loading traffic...",
        restricted_title: "Superadmin only",
        restricted_desc: "This panel is only available to superadmins.",
        eyebrow: "Superadmin",
        title: "Traffic and access",
        subtitle: "Recorded logins with user, company, IP, device, and location when the proxy sends it.",
        last_event: "Last access",
        total_accesses: "Accesses",
        last_24h: "Last 24h",
        last_7d: "Last 7 days",
        unique_users: "Unique users",
        locations_seen: "Locations",
        map_title: "Access map",
        map_subtitle: "2D map with approximate location from public IP or proxy/CDN.",
        unknown_user: "Unknown user",
        no_map_points: "No coordinates yet",
        no_map_points_desc: "Localhost may have no coordinates. Production uses public IP or proxy/CDN headers.",
        active_locations: "Active locations",
        reach_period: "Last 12 months",
        search: "Search",
        summary: "Summary",
        download: "Download",
        first_time_visits: "First-time visits",
        repeat_viewers: "Repeat viewers",
        avg_engagement: "Avg. engagement time",
        view_details: "View details",
        direct_organic: "Direct vs Organic",
        users_by_platform: "Users by platform",
        activity_heatmap: "Activity heatmap",
        month: "Month",
        trend_title: "Weekly traffic",
        trend_subtitle: "Logins per day.",
        table_title: "Recent access",
        table_subtitle: "Users who logged in to the app.",
        tab_logins: "Logins",
        tab_url_only: "URL only",
        visitor: "Visitor",
        page: "URL",
        referrer: "Referrer",
        user: "User",
        company: "Company",
        location: "Location",
        ip: "IP",
        device: "Device",
        time: "Time",
        mobile: "Mobile",
        desktop: "Desktop",
        browser: "Browser",
        previous: "Previous",
        next: "Next",
        page_of: "Page {page} of {pages}",
        empty: "No access events yet. New logins will appear here.",
    },
};

export type TrafficLabels = typeof fallbackTraffic.es;

export const TRAFFIC_DATE_TIME_FORMATTERS = {
    en: new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }),
    es: new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
    }),
};

export function parseCoordinate(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function getGeoLabel(event: AuditLog) {
    const geo = event.details.geo;
    return [geo?.city, geo?.region, geo?.country].filter(Boolean).join(", ") || "-";
}

export function getDeviceLabel(
    userAgent: string | null | undefined,
    traffic: TrafficLabels,
) {
    const value = String(userAgent || "");
    if (!value) return "-";
    if (/iphone|ipad|android|mobile/i.test(value)) return traffic.mobile;
    if (/macintosh|windows|linux/i.test(value)) return traffic.desktop;
    return traffic.browser;
}

export function formatDateTime(value: string, locale: "en" | "es") {
    return TRAFFIC_DATE_TIME_FORMATTERS[locale].format(new Date(value));
}

export function startOfDayKey(value: string) {
    return value.slice(0, 10);
}
