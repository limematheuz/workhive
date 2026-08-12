import type { AuditLog } from "../../types/audit-log";
import type { TrafficMapPoint } from "../traffic-map";

export const TRAFFIC_PAGE_SIZE = 12;

export const fallbackTraffic = {
    es: {
        loading: "Cargando tráfico...",
        restricted_title: "Solo superadmin",
        restricted_desc: "Este panel solo está disponible para superadmins.",
        eyebrow: "Superadmin",
        title: "Tráfico y accesos",
        subtitle: "Logins y visitas anónimas con usuario, empresa, IP, dispositivo y ubicación cuando está disponible.",
        last_event: "Último acceso",
        total_accesses: "Accesos",
        last_24h: "Últimas 24 h",
        last_7d: "Últimos 7 días",
        unique_users: "Usuarios únicos",
        locations_seen: "Ubicaciones",
        map_title: "Mapa de accesos",
        map_subtitle: "Solo inicios de sesión. Ubicación aproximada por IP pública; una VPN o red corporativa puede mostrar otra ciudad.",
        unknown_user: "Usuario desconocido",
        no_map_points: "Sin coordenadas todavía",
        no_map_points_desc: "Los accesos autenticados nuevos aparecerán cuando tengan una ubicación aproximada por IP pública.",
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
        tablet: "Tablet",
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
        subtitle: "Logins and anonymous page views with user, company, IP, device, and location when available.",
        last_event: "Last access",
        total_accesses: "Accesses",
        last_24h: "Last 24h",
        last_7d: "Last 7 days",
        unique_users: "Unique users",
        locations_seen: "Locations",
        map_title: "Access map",
        map_subtitle: "Signed-in access only. Location is approximate from public IP; VPNs and corporate networks may show another city.",
        unknown_user: "Unknown user",
        no_map_points: "No coordinates yet",
        no_map_points_desc: "New signed-in access will appear when an approximate public-IP location is available.",
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
        tablet: "Tablet",
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

export type DeviceKind = "desktop" | "mobile" | "tablet" | "browser";

export function getDeviceKind(userAgent: string | null | undefined): DeviceKind {
    const value = String(userAgent || "").toLowerCase();
    if (!value) return "browser";

    // iPadOS may present a desktop-like Macintosh user agent with a Mobile
    // token, while Android tablets do not include Mobile.
    if (
        /ipad|tablet|playbook|silk|kindle|kftt|kfapwi/.test(value)
        || (/macintosh/.test(value) && /mobile/.test(value))
        || (/android/.test(value) && !/mobile/.test(value))
    ) {
        return "tablet";
    }
    if (/iphone|ipod|windows phone|android.*mobile|mobi/.test(value)) return "mobile";
    if (/macintosh|windows|linux|cros/.test(value)) return "desktop";
    return "browser";
}

export function getDeviceLabel(
    userAgent: string | null | undefined,
    traffic: TrafficLabels,
) {
    const deviceKind = getDeviceKind(userAgent);
    if (deviceKind === "mobile") return traffic.mobile;
    if (deviceKind === "tablet") return traffic.tablet;
    if (deviceKind === "desktop") return traffic.desktop;
    return traffic.browser;
}

export function getAuthenticatedTrafficMapPoints(
    events: AuditLog[],
    unknownUserLabel: string,
): TrafficMapPoint[] {
    return events.flatMap((event) => {
        if (event.action !== "auth.login") return [];

        const lat = parseCoordinate(event.details.geo?.latitude);
        const lng = parseCoordinate(event.details.geo?.longitude);
        if (lat === null || lng === null) return [];

        return [{
            id: event.id.toString(),
            lat,
            lng,
            label: event.details.user_email || unknownUserLabel,
            location: getGeoLabel(event),
        }];
    });
}

export function formatDateTime(value: string, locale: "en" | "es") {
    return TRAFFIC_DATE_TIME_FORMATTERS[locale].format(new Date(value));
}

export function startOfDayKey(value: string) {
    return value.slice(0, 10);
}
