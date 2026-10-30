import { cleanChecklistDescription } from "../../lib/format.ts";

interface KanbanFilterTask {
    title: string;
    description?: string | null;
    notes?: string | null;
    status: string;
    is_invoiced?: boolean;
    user_id?: number | null;
    location_id: number;
    assignments?: readonly { user_id: number }[];
}

export function filterTasksForKanban<T extends KanbanFilterTask>(
    tasks: readonly T[],
    filters: { query: string; userId: string; locationId: string },
): T[] {
    const query = filters.query.trim().toLocaleLowerCase("es");
    const userId = Number(filters.userId);
    const locationId = Number(filters.locationId);
    return tasks.filter(task => {
        if (task.is_invoiced || task.status === "requested" || task.status === "rejected") return false;
        if (filters.userId !== "ALL" && task.user_id !== userId
            && !task.assignments?.some(assignment => assignment.user_id === userId)) return false;
        if (filters.locationId !== "ALL" && task.location_id !== locationId) return false;
        return !query || [task.title, cleanChecklistDescription(task.description), task.notes]
            .some(value => value?.toLocaleLowerCase("es").includes(query));
    });
}
