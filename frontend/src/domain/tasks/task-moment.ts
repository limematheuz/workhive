import { isTaskDateOnlyValue, parseTaskCalendarDate } from "./task-schedule.ts";
export function taskMoment(value: string | null | undefined, locale = "es-ES") {
    const date = value ? parseTaskCalendarDate(value) : null;
    if (!date || !value) return "Fecha pendiente";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...((isTaskDateOnlyValue(value)||/^\d{4}-\d{2}-\d{2}$/.test(value)) ? {} : { timeStyle: "short" as const }) }).format(date);
}
