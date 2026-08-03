type TaskReportDateStyle = "card" | "detail" | "full";

const dateTimeOptions: Record<TaskReportDateStyle, Intl.DateTimeFormatOptions> = {
    card: { dateStyle: "short", timeStyle: "short", timeZone: "UTC" },
    detail: { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" },
    full: { dateStyle: "full", timeStyle: "short", timeZone: "UTC" },
};

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

function getTaskReportDateFormatter(locale: string, style: TaskReportDateStyle) {
    const key = `${locale}:${style}`;
    const cached = dateTimeFormatters.get(key);
    if (cached) return cached;

    const formatter = new Intl.DateTimeFormat(locale, dateTimeOptions[style]);
    dateTimeFormatters.set(key, formatter);
    return formatter;
}

export function formatTaskReportDate(
    value: string,
    locale: string,
    style: TaskReportDateStyle,
): string {
    return getTaskReportDateFormatter(locale, style).format(new Date(value));
}
