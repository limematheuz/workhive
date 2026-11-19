type DateStyle = "period" | "time" | "short" | "reservation";
const options: Record<DateStyle, Intl.DateTimeFormatOptions> = {
    period: { weekday: "short", day: "numeric", month: "long" },
    time: { hour: "2-digit", minute: "2-digit" },
    short: { day: "numeric", month: "short" },
    reservation: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
};
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Overview mounts after the session loads on the client; use the workspace's local dates. */
export function formatOverviewDate(date: Date, locale: string, style: DateStyle): string {
    const key = `${locale}:${style}`;
    let formatter = dateFormatters.get(key);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat(locale, options[style]);
        dateFormatters.set(key, formatter);
    }
    return formatter.format(date);
}
