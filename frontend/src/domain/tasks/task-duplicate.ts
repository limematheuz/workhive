import type { TaskItem } from "../../types/user";
import type { TaskItemCreate } from "../../services/task.service";
import { resetTaskChecklistProgress } from "../../lib/task-checklist.ts";

/** Copy the work definition, never the execution or billing history. */
export function buildTaskDuplicatePayload(task: TaskItem): TaskItemCreate {
    return {
        title: `${task.title} (Copia)`,
        notes: task.notes || null,
        description: resetTaskChecklistProgress(task.description),
        price: task.price,
        quantity: task.quantity,
        unit: task.unit || "unidad",
        pricing_mode: task.pricing_mode || "fixed",
        template_task_id: task.template_task_id,
        location_id: task.location_id,
        user_id: task.user_id,
        priority: task.priority || "medium",
        zone_ids: task.zones?.map((zone) => zone.space_id),
    };
}
