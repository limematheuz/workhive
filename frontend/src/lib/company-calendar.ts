import type { TaskItem } from "../types/user";
import { isTaskDateOnlyValue, parseTaskCalendarDate } from "../domain/tasks/task-schedule.ts";

export interface TaskCalendarRange {
    start: Date;
    end: Date;
    allDay: boolean;
}


export function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatLocalCalendarDay(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getTaskCalendarRange(task: TaskItem): TaskCalendarRange | null {
    const value = task.scheduled_start_at || task.due_at;
    if (!value) return null;

    const start = parseTaskCalendarDate(value);
    if (!start) return null;
    if (isTaskDateOnlyValue(value)) {
        const dayStart = startOfLocalDay(start);
        const nextDay = new Date(dayStart);
        nextDay.setDate(nextDay.getDate() + 1);
        return { start: dayStart, end: nextDay, allDay: true };
    }
    const due = task.due_at ? parseTaskCalendarDate(task.due_at) : null;
    const end = due && due.getTime() > start.getTime()
        ? due
        : new Date(start.getTime() + 60 * 60 * 1000);

    return { start, end, allDay: false };
}

export function getTaskCalendarDate(task: TaskItem): Date | null {
    return getTaskCalendarRange(task)?.start || null;
}

export function getMonthCalendarDays(month: Date): Date[] {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - mondayOffset);

    return Array.from({ length: 42 }, (_, index) => {
        const day = new Date(gridStart);
        day.setDate(gridStart.getDate() + index);
        return day;
    });
}

export function getTaskCalendarDurationMinutes(task: TaskItem): number | null {
    const range = getTaskCalendarRange(task);
    if (!range) return null;
    return Math.max(
        1,
        Math.round((range.end.getTime() - range.start.getTime()) / 60000),
    );
}
