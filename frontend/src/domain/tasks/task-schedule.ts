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

function getUtcMidnightDateParts(value: string): [number, number, number] | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.0+)?(?:Z|\+00:00)$/.exec(value);
    if (!match) return null;
    const [, year, month, day] = match;
    return [Number(year), Number(month) - 1, Number(day)];
}

export function isTaskDateOnlyValue(value: string | null | undefined): boolean {
    // Older date-only tasks used the last millisecond of the selected day.
    // An edited 23:59:00 value is ambiguous and must remain a timed task.
    if (!value) return false;
    if (getUtcMidnightDateParts(value)) return true;
    if (!/T\d{2}:59:59\.999(?:0{0,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
    const date = parseDate(value);
    return Boolean(date && date.getHours() === 23 && date.getMinutes() === 59);
}

function padDatePart(value: number): string {
    return String(value).padStart(2, "0");
}

function parseTaskPlanningDate(value: string): Date | null {
    const parts = getUtcMidnightDateParts(value);
    if (!parts) return parseDate(value);
    return new Date(parts[0], parts[1], parts[2], 23, 59, 59, 999);
}

export function parseTaskCalendarDate(value: string): Date | null {
    const parts = getUtcMidnightDateParts(value);
    if (parts) return new Date(parts[0], parts[1], parts[2], 12, 0, 0, 0);
    const date = parseDate(value);
    if (!date || !isTaskDateOnlyValue(value)) return date;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

export function toTaskPlanningDateInput(value: string | null | undefined): string {
    if (!value) return "";
    const parts = getUtcMidnightDateParts(value);
    const date = parts ? new Date(parts[0], parts[1], parts[2], 12) : parseDate(value);
    if (!date) return "";
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

export function toTaskPlanningTimeInput(
    value: string | null | undefined,
    fallback = "12:00",
): string {
    if (!value) return fallback;
    if (isTaskDateOnlyValue(value)) return "";
    const date = parseDate(value);
    if (!date) return fallback;
    return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function isTaskPlanningDateBeforeToday(
    value: string | Date | null | undefined,
    now = new Date(),
): boolean {
    if (!value) return false;
    let date: Date | null;
    if (value instanceof Date) {
        date = Number.isNaN(value.getTime()) ? null : value;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split("-").map(Number);
        date = new Date(year, month - 1, day, 12);
        if (
            date.getFullYear() !== year
            || date.getMonth() !== month - 1
            || date.getDate() !== day
        ) date = null;
    } else {
        date = parseTaskCalendarDate(value);
    }
    return Boolean(date && startOfLocalDay(date) < startOfLocalDay(now));
}

/** Historical work remains editable, but its date cannot be moved into the past. */
export function isTaskPlanningDateChangeToPast(
    currentPlanningDate: string,
    nextPlanningDate: string,
    now = new Date(),
): boolean {
    return (
        currentPlanningDate !== nextPlanningDate
        && isTaskPlanningDateBeforeToday(nextPlanningDate, now)
    );
}

export function getTaskScheduleDate(task: TaskItem): Date | null {
    const scheduled = task.scheduled_start_at || task.due_at || task.created_at;
    return scheduled ? parseTaskPlanningDate(scheduled) : null;
}

const PRIORITY_ORDER = {
    high: 0,
    medium: 1,
    low: 2,
} as const;

export function sortTasksByOperationalPriority(tasks: TaskItem[]): TaskItem[] {
    return [...tasks].sort((left, right) => {
        const leftPriority = PRIORITY_ORDER[left.priority || "medium"];
        const rightPriority = PRIORITY_ORDER[right.priority || "medium"];
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const leftTime = getTaskScheduleDate(left)?.getTime() ?? Number.POSITIVE_INFINITY;
        const rightTime = getTaskScheduleDate(right)?.getTime() ?? Number.POSITIVE_INFINITY;
        if (leftTime !== rightTime) return leftTime - rightTime;
        return right.id - left.id;
    });
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

export function getTasksForOverviewTab(
    tasks: TaskItem[],
    tab: OverviewTab,
    now = new Date(),
): TaskItem[] {
    if (tab === "todo") return [...tasks];
    const range = getOverviewDateRange(tab, now);
    return tasks.filter((task) => isDateInRange(getTaskScheduleDate(task), range));
}

export function getOverviewTabForDate(
    value: string | null | undefined,
    now = new Date(),
): OverviewTab {
    const date = value ? parseTaskPlanningDate(value) : null;
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
