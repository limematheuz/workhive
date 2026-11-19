import type { TaskItem } from "../../types/user.ts";
import { buildOperationsOverview, overviewRange, plannedDate, taskWorkers } from "./operations-overview.ts";
import { addDays, isTaskDateOnlyValue, startOfLocalDay } from "./task-schedule.ts";

export type AttentionReason = "late" | "carried" | "unassigned" | "review" | "unscheduled" | "invoice";
export const attentionLabels: Record<AttentionReason, string> = {
    late: "Hora de inicio superada", carried: "Pendiente de días anteriores", unassigned: "Sin responsable hoy",
    review: "Pendiente de revisión", unscheduled: "Fecha pendiente", invoice: "Terminado sin facturar",
};

/** One record can need several actions; it must only count once in the attention queue. */
export function buildAttentionQueue(tasks: TaskItem[], now: Date) {
    const data = buildOperationsOverview(tasks, overviewRange("today", "", now), now);
    const groups: [AttentionReason, TaskItem[]][] = [
        ["late", data.late], ["carried", data.carriedOver], ["unassigned", data.unassigned],
        ["review", data.review], ["unscheduled", data.unscheduled],
        ["invoice", tasks.filter(task => task.status === "completed" && !task.is_invoiced)],
    ];
    const rows = new Map<number, { task: TaskItem; reasons: AttentionReason[]; priority: number }>();
    groups.forEach(([reason, items], priority) => items.forEach(task => {
        const row = rows.get(task.id) ?? { task, reasons: [], priority };
        if (!row.reasons.includes(reason)) row.reasons.push(reason);
        rows.set(task.id, row);
    }));
    return [...rows.values()].sort((a, b) => a.priority - b.priority
        || (plannedDate(a.task)?.getTime() ?? Infinity) - (plannedDate(b.task)?.getTime() ?? Infinity)
        || a.task.id - b.task.id);
}

/** Rolling forecast uses real schedule dates, never the date a record was created. */
export function operationForecast(tasks: TaskItem[], now: Date, days = 7) {
    const start = startOfLocalDay(now);
    return Array.from({ length: days }, (_, index) => {
        const date = addDays(start, index);
        const data = buildOperationsOverview(tasks, { start: date, end: addDays(date, 1) }, now);
        return { date, tasks: data.planned, unassigned: data.unassigned.length, workers: data.team.length };
    });
}

export type ScheduleConflict = { first: TaskItem; second: TaskItem; workerIds: number[] };
/** Date-only events have no known interval and cannot establish a personnel conflict. */
export function taskScheduleConflicts(tasks: TaskItem[]): ScheduleConflict[] {
    const timed = tasks.filter(task => !["cancelled", "rejected", "completed"].includes(task.status)
        && task.scheduled_start_at && task.due_at
        && !isTaskDateOnlyValue(task.scheduled_start_at) && !isTaskDateOnlyValue(task.due_at)
        && new Date(task.due_at).getTime() > new Date(task.scheduled_start_at).getTime())
        .sort((a, b) => new Date(a.scheduled_start_at!).getTime() - new Date(b.scheduled_start_at!).getTime());
    const conflicts: ScheduleConflict[] = [];
    for (let index = 0; index < timed.length; index++) {
        const first = timed[index], firstWorkers = new Set(taskWorkers(first).map(worker => worker.id));
        for (let next = index + 1; next < timed.length; next++) {
            const second = timed[next];
            if (new Date(second.scheduled_start_at!) >= new Date(first.due_at!)) break;
            const workerIds = taskWorkers(second).map(worker => worker.id).filter(id => firstWorkers.has(id));
            if (workerIds.length) conflicts.push({ first, second, workerIds });
        }
    }
    return conflicts;
}
