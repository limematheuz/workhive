function formatInTimeZone(
    value: string,
    locale: string,
    timeZone: string | null,
    options: Intl.DateTimeFormatOptions,
): string {
    if (!timeZone) return "—";
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(value));
}

export function formatReservationDate(
    value: string,
    locale: string,
    timeZone: string | null,
    includeWeekday = false,
): string {
    return formatInTimeZone(value, locale, timeZone, {
        day: "numeric",
        month: "short",
        ...(includeWeekday ? { weekday: "short" as const } : {}),
    });
}

export function formatReservationTime(
    value: string,
    locale: string,
    timeZone: string | null,
): string {
    return formatInTimeZone(value, locale, timeZone, {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatReservationDateTime(
    value: string,
    locale: string,
    timeZone: string | null,
): string {
    return formatInTimeZone(value, locale, timeZone, {
        dateStyle: "short",
        timeStyle: "short",
    });
}
