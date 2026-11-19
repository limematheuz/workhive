import { taskScheduleConflicts } from "@/domain/tasks/operation-priorities";
import { taskWorkers, plannedDate } from "@/domain/tasks/operations-overview";
import type { TaskItem } from "@/types/user";
import { Button } from "@/components/ui/button";

export function CalendarPlanningAttention({ tasks, range, locationName, workerName, onOpen }: {
    tasks: TaskItem[]; range: { start: Date; end: Date } | null;
    locationName: (id: number) => string; workerName: (id: number) => string; onOpen: (id: number) => void;
}) {
    if (!range) return null;
    const visible = tasks.filter(task => {
        const start = plannedDate(task), end = task.due_at ? new Date(task.due_at) : start;
        return start && end && start < range.end && end >= range.start;
    });
    const unassigned = visible.filter(task => !["completed", "cancelled"].includes(task.status) && !taskWorkers(task).length);
    const conflicts = taskScheduleConflicts(visible);
    if (!unassigned.length && !conflicts.length) return <p className="text-xs text-muted-foreground">Sin trabajos sin asignar ni solapamientos de personal en el periodo visible. La disponibilidad contratada no está incluida en esta comprobación.</p>;
    return <section aria-label="Revisar planificación del periodo visible" className="rounded-2xl border border-orange-400/40 bg-orange-500/5 p-4">
        <h2 className="font-semibold">Revisar este periodo</h2>
        <div className="mt-2 flex flex-wrap gap-2">
            {unassigned.map(task => <Button key={task.id} variant="outline" size="sm" onClick={() => onOpen(task.id)} className="h-auto whitespace-normal text-left">Sin asignar · {task.title} · {locationName(task.location_id)}</Button>)}
        </div>
        {conflicts.length > 0 && <ul className="mt-3 space-y-2 text-sm">{conflicts.map(({ first, second, workerIds }) => <li key={`${first.id}:${second.id}`} className="rounded-xl bg-background/70 p-3"><p className="font-medium">Horario solapado · {workerIds.map(workerName).join(", ")}</p><div className="mt-1 flex flex-wrap items-center gap-2"><Button variant="link" size="sm" onClick={() => onOpen(first.id)}>{first.title}</Button><span>coincide con</span><Button variant="link" size="sm" onClick={() => onOpen(second.id)}>{second.title}</Button></div></li>)}</ul>}
    </section>;
}
