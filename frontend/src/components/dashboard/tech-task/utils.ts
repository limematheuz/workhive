export interface PropertyFeatures {
    rooms: number;
    bathrooms: number;
    kitchens: number;
    hasTerrace: boolean;
    hasGarage: boolean;
}

function getTechLabel(dict: Dictionary | undefined, key: string): string | undefined {
    const labels: Record<string, unknown> | undefined = dict?.tech;
    const label = labels?.[key];
    return typeof label === "string" ? label : undefined;
}

export function formatWorkedTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatClockTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return [hours, minutes, remainingSeconds]
        .map(value => value.toString().padStart(2, "0"))
        .join(":");
}

export function formatShortDateTime(value: string | null | undefined, locale: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(locale === "es" ? "es-ES" : "en-US", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}
export function formatStayType(value: string, locale: string, dict?: Dictionary): string {
    const translatedLabel = getTechLabel(dict, `stay_type_${value}`);
    if (translatedLabel) return translatedLabel;
    const labels: Record<string, { es: string; en: string }> = {
        guest: { es: "Estancia de huéspedes", en: "Guest stay" },
        owner: { es: "Estancia del propietario", en: "Owner stay" },
        vacant: { es: "Sin huéspedes", en: "Vacant" },
        maintenance: { es: "Mantenimiento", en: "Maintenance" },
    };
    const label = labels[value];
    return label ? (locale === "es" ? label.es : label.en) : value;
}

export function getLocationTypeLabel(locationType: string | undefined, locale: string, dict?: Dictionary): string {
    const key = locationType || "private";
    const translatedLabel = getTechLabel(dict, `location_type_${key}`);
    if (translatedLabel) return translatedLabel;
    const labels: Record<string, { es: string; en: string }> = {
        private: { es: "Vivienda", en: "Home" },
        real_estate: { es: "Vivienda gestionada", en: "Managed home" },
        business: { es: "Negocio", en: "Business" },
        exterior: { es: "Espacio exterior", en: "Outdoor space" },
        other: { es: "Otro espacio", en: "Other place" },
    };
    const label = labels[key] || labels.other;
    return locale === "es" ? label.es : label.en;
}

export function getServiceContextLabel(serviceContext: string | undefined, locale: string, dict?: Dictionary): string {
    const key = serviceContext || "standalone";
    const translatedLabel = getTechLabel(dict, `service_context_${key}`);
    if (translatedLabel) return translatedLabel;
    const labels: Record<string, { es: string; en: string }> = {
        checkout: { es: "Cambio de huéspedes", en: "Guest turnover" },
        turnover: { es: "Cambio de huéspedes", en: "Guest turnover" },
        pre_arrival: { es: "Preparación de entrada", en: "Pre-arrival" },
        maintenance: { es: "Mantenimiento", en: "Maintenance" },
        standalone: { es: "Trabajo independiente", en: "Standalone work" },
    };
    const label = labels[key] || labels.standalone;
    return locale === "es" ? label.es : label.en;
}

export function getPriorityBadge(
    priority: string | undefined,
    locale: string,
    dict?: Dictionary
): { text: string; className: string } {
    const p = priority || "medium";
    const labels = {
        high: dict?.tasks?.priority_high ? dict.tasks.priority_high.toUpperCase() : (locale === "es" ? "ALTA" : "HIGH"),
        medium: dict?.tasks?.priority_medium ? dict.tasks.priority_medium.toUpperCase() : (locale === "es" ? "MEDIA" : "MEDIUM"),
        low: dict?.tasks?.priority_low ? dict.tasks.priority_low.toUpperCase() : (locale === "es" ? "BAJA" : "LOW"),
    };
    if (p === "high") {
        return {
            text: labels.high,
            className: "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
        };
    } else if (p === "medium") {
        return {
            text: labels.medium,
            className: "bg-orange-500/10 border border-orange-500/25 text-orange-700 dark:text-orange-300"
        };
    } else {
        return {
            text: labels.low,
            className: "bg-accent/10 border border-accent/20 text-accent dark:text-accent"
        };
    }
}
import type { Dictionary } from "@/lib/dictionary-context";
