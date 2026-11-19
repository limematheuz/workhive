import type { TaskItem } from "../../types/user.ts";
import { isTaskDateOnlyValue } from "./task-schedule.ts";

/** Only schedule fields change. A deadline without a known interval needs individual review. */
export function taskReschedulePatch(task: TaskItem, next: Date) {
    if (!Number.isFinite(next.getTime())) throw new Error("La nueva fecha no es válida.");
    if (task.is_invoiced || ["completed", "cancelled", "requested", "rejected"].includes(task.status)) throw new Error("El estado actual del trabajo requiere revisión individual.");
    let duration: number | null = null;
    if (task.due_at) {
        if (!task.scheduled_start_at || isTaskDateOnlyValue(task.scheduled_start_at) || isTaskDateOnlyValue(task.due_at)) throw new Error("Revisa este trabajo individualmente: su duración no está definida.");
        duration = new Date(task.due_at).getTime() - new Date(task.scheduled_start_at).getTime();
        if (!Number.isFinite(duration) || duration <= 0) throw new Error("Revisa la duración de este trabajo antes de reprogramarlo.");
    }
    return { scheduled_start_at: next.toISOString(), due_at: duration === null ? null : new Date(next.getTime() + duration).toISOString() };
}
