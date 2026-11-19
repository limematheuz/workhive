import type { TaskItem } from "../../types/user.ts";
import { isTaskDateOnlyValue, parseTaskCalendarDate, startOfLocalDay } from "./task-schedule.ts";

export function taskDeadlinePassed(task: TaskItem, now: Date) {
    if (["completed", "cancelled", "rejected", "requested"].includes(task.status)) return false;
    const value = task.due_at;
    const date = value ? parseTaskCalendarDate(value) : null;
    if (!date || !value) return false;
    return (isTaskDateOnlyValue(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) ? startOfLocalDay(date) < startOfLocalDay(now) : date < now;
}
export function taskCompletedThisWeek(task: TaskItem, now: Date) {
    if (task.status !== "completed" || !task.date_done) return false;
    const monday = startOfLocalDay(now);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const done = new Date(task.date_done);
    return done >= monday && done <= now;
}
