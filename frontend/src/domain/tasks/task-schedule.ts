import type { TaskItem } from "@/types/user";

export type OverviewTab = "hoy" | "manana" | "semana" | "todo";

export interface DateRange {
    start: Date;
    end: Date;
}

export type ScheduleViolation =
    | { type: "before_checkout"; boundary: Date }
    | { type: "after_next_checkin"; boundary: Date };

export function startOfLocalDay(date: Date): Date {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return day;
}

export function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

export function parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function getTaskScheduleDate(task: TaskItem): Date | null {
    return parseDate(
        task.scheduled_start_at || task.due_at || task.created_at,
    );
}

export function isDateInRange(
    date: Date | null,
    range: DateRange,
): boolean {
    return Boolean(date && date >= range.start && date < range.end);
}

export function getOverviewDateRange(
    tab: Exclude<OverviewTab, "todo">,
    now = new Date(),
): DateRange {
    const today = startOfLocalDay(now);
    if (tab === "hoy") {
        return { start: today, end: addDays(today, 1) };
    }
    if (tab === "manana") {
        const tomorrow = addDays(today, 1);
        return { start: tomorrow, end: addDays(tomorrow, 1) };
    }
    return { start: today, end: addDays(today, 7) };
}

export function getOverviewTabForDate(
    value: string | null | undefined,
    now = new Date(),
): OverviewTab {
    const date = parseDate(value);
    if (!date) return "hoy";
    for (const tab of ["hoy", "manana", "semana"] as const) {
        if (isDateInRange(date, getOverviewDateRange(tab, now))) return tab;
    }
    return "todo";
}

export function isTaskOverdue(
    task: TaskItem,
    now = new Date(),
    thresholdHours = 24,
): boolean {
    const taskDate = getTaskScheduleDate(task);
    if (!taskDate) return false;
    return now.getTime() - taskDate.getTime() > thresholdHours * 60 * 60 * 1000;
}

export function getScheduleViolation(
    task: TaskItem,
    scheduledStartAt: string | null,
): ScheduleViolation | null {
    const scheduled = parseDate(scheduledStartAt);
    if (!scheduled) return null;

    const checkout = parseDate(task.checkout_reservation?.check_out_at);
    if (checkout && scheduled < checkout) {
        return { type: "before_checkout", boundary: checkout };
    }

    const nextCheckin = parseDate(task.next_reservation?.check_in_at);
    if (nextCheckin && scheduled > nextCheckin) {
        return { type: "after_next_checkin", boundary: nextCheckin };
    }

    return null;
}
