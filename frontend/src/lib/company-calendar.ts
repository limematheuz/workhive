import type { TaskItem } from "../types/user";

export interface TaskCalendarRange {
    start: Date;
    end: Date;
}


export function startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getTaskCalendarRange(task: TaskItem): TaskCalendarRange | null {
    const value = task.scheduled_start_at || task.due_at;
    if (!value) return null;

    const start = new Date(value);
    const due = task.due_at ? new Date(task.due_at) : null;
    const end = due && due.getTime() > start.getTime()
        ? due
        : new Date(start.getTime() + 60 * 60 * 1000);

    return { start, end };
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
