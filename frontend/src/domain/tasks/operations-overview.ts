import type { TaskItem } from "../../types/user.ts";
import { addDays, isTaskDateOnlyValue, parseTaskCalendarDate, startOfLocalDay } from "./task-schedule.ts";

export type OverviewPeriod = "today" | "tomorrow" | "week" | "date";
export type AgendaFilter = "all" | "pending" | "progress" | "review" | "completed" | "unassigned" | "late";
export type OverviewRange = { start: Date; end: Date };

export function overviewRange(period: OverviewPeriod, selectedDate: string, now: Date): OverviewRange {
    const today = startOfLocalDay(now);
    if (period === "tomorrow") return { start: addDays(today, 1), end: addDays(today, 2) };
    if (period === "week") {
        const start = addDays(today, -(today.getDay() + 6) % 7);
        return { start, end: addDays(start, 7) };
    }
    if (period === "date" && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        const [year, month, day] = selectedDate.split("-").map(Number);
        const start = new Date(year, month - 1, day);
        if (start.getFullYear() === year && start.getMonth() === month - 1 && start.getDate() === day) {
            return { start, end: addDays(start, 1) };
        }
    }
    return { start: today, end: addDays(today, 1) };
}

/** No created_at fallback: creation is not a scheduling decision. */
export function plannedDate(task: TaskItem): Date | null {
    const value = task.scheduled_start_at || task.due_at;
    return value ? parseTaskCalendarDate(value) : null;
}

export function isInOverviewRange(date: Date | null, range: OverviewRange): boolean {
    return Boolean(date && date >= range.start && date < range.end);
}

export function overviewStatus(task: TaskItem): "pending" | "progress" | "review" | "completed" | "cancelled" {
    if (task.status === "completed" || task.status === "cancelled") return task.status;
    if (task.status === "progress" || task.status === "in_progress") return "progress";
    if (task.status === "review" || task.status === "in_review") return "review";
    return "pending";
}

export function taskWorkers(task: TaskItem): { id: number; name: string | null }[] {
    const workers = new Map<number, string | null>();
    const rejected = new Set<number>();
    for (const assignment of task.assignments || []) {
        if (assignment.status === "rejected" || assignment.status === "cancelled") rejected.add(assignment.user_id);
    }
    if (task.user_id != null && task.status !== "rejected" && !rejected.has(task.user_id)) workers.set(task.user_id, null);
    for (const assignment of task.assignments || []) {
        if (assignment.status !== "rejected" && assignment.status !== "cancelled") workers.set(assignment.user_id, assignment.user_name);
    }
    return [...workers].map(([id, name]) => ({ id, name }));
}

export function taskIsLate(task: TaskItem, now: Date): boolean {
    if (overviewStatus(task) !== "pending") return false;
    const value = task.scheduled_start_at || task.due_at;
    const date = plannedDate(task);
    if (!value || !date) return false;
    // A date-only task does not become late at midnight.
    return isTaskDateOnlyValue(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? startOfLocalDay(date) < startOfLocalDay(now)
        : date < now;
}

function plannedMinutes(task: TaskItem, range: OverviewRange): number | null {
    if (!task.scheduled_start_at || !task.due_at || isTaskDateOnlyValue(task.scheduled_start_at) || isTaskDateOnlyValue(task.due_at)) return null;
    const start = new Date(task.scheduled_start_at).getTime();
    const end = new Date(task.due_at).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && end > start ? Math.max(0, Math.min(end, range.end.getTime()) - Math.max(start, range.start.getTime())) / 60_000 : null;
}

function scheduledInRange(task: TaskItem, range: OverviewRange): boolean {
    if (isInOverviewRange(plannedDate(task), range)) return true;
    if (!task.scheduled_start_at || !task.due_at || isTaskDateOnlyValue(task.scheduled_start_at) || isTaskDateOnlyValue(task.due_at)) return false;
    const start = new Date(task.scheduled_start_at);
    const end = new Date(task.due_at);
    return start < range.end && end > range.start && end > start;
}

export function buildOperationsOverview(tasks: TaskItem[], range: OverviewRange, now: Date) {
    const active = tasks.filter(task => task.status !== "cancelled");
    const planned = active.filter(task => scheduledInRange(task, range)).sort((a, b) => {
        const time = plannedDate(a)!.getTime() - plannedDate(b)!.getTime();
        return time || a.id - b.id;
    });
    const pending = planned.filter(task => overviewStatus(task) === "pending");
    const completed = planned.filter(task => overviewStatus(task) === "completed");
    const progress = planned.filter(task => overviewStatus(task) === "progress");
    const review = planned.filter(task => overviewStatus(task) === "review");
    const unassigned = planned.filter(task => overviewStatus(task) !== "completed" && taskWorkers(task).length === 0);
    const late = planned.filter(task => taskIsLate(task, now));
    const awaitingAcceptance = planned.filter(task => task.status === "requested");
    const unscheduled = active.filter(task => !plannedDate(task) && overviewStatus(task) !== "completed");
    const carriedOver = active.filter(task => {
        const date = plannedDate(task);
        return date && date < range.start && !scheduledInRange(task, range) && overviewStatus(task) !== "completed";
    });
    const team = new Map<number, { id: number; name: string | null; tasks: TaskItem[] }>();
    for (const task of planned) for (const worker of taskWorkers(task)) {
        const person = team.get(worker.id) || { ...worker, tasks: [] };
        person.name ||= worker.name;
        person.tasks.push(task);
        team.set(worker.id, person);
    }
    const durations = planned.map(task => plannedMinutes(task, range));
    return {
        planned, pending, completed, progress, review, unassigned, late, awaitingAcceptance, unscheduled, carriedOver,
        team: [...team.values()],
        plannedMinutes: durations.reduce<number>((sum, minutes) => sum + (minutes || 0), 0),
        missingDuration: durations.filter(minutes => minutes == null).length,
        completion: planned.length ? Math.round(completed.length / planned.length * 100) : 0,
    };
}

export type OperationsOverview = ReturnType<typeof buildOperationsOverview>;

export function groupOverviewLocations(tasks: TaskItem[]) {
    const groups = new Map<number, { locationId: number; tasks: TaskItem[]; workers: Map<number, string | null>; completed: number; unassigned: number }>();
    for (const task of tasks) {
        if (task.status === "cancelled") continue;
        const group = groups.get(task.location_id) || { locationId: task.location_id, tasks: [], workers: new Map<number, string | null>(), completed: 0, unassigned: 0 };
        const workers = taskWorkers(task);
        group.tasks.push(task);
        for (const worker of workers) group.workers.set(worker.id, worker.name || group.workers.get(worker.id) || null);
        if (overviewStatus(task) === "completed") group.completed++;
        else if (workers.length === 0) group.unassigned++;
        groups.set(task.location_id, group);
    }
    return [...groups.values()];
}

export function filterOverviewAgenda(overview: OperationsOverview, filter: AgendaFilter): TaskItem[] {
    return filter === "all" ? overview.planned : overview[filter];
}
