"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { TaskService, type TaskItem } from "@/services/task.service";
import { isTaskPlanningDateBeforeToday } from "@/domain/tasks/task-schedule";
import { taskReschedulePatch } from "@/domain/tasks/task-reschedule";

export function TaskBatchSchedule({ tasks, onUpdated, onClear }: { tasks: TaskItem[]; onUpdated: () => void; onClear: () => void }) {
    const [date, setDate] = useState<string | null>(null), [busy, setBusy] = useState(false);
    const [results, setResults] = useState<{ id: number; title: string; error?: string }[]>([]);
    const [error, setError] = useState("");
    const submit = async () => {
        const next = date ? new Date(date) : null;
        if (!next || !Number.isFinite(next.getTime()) || isTaskPlanningDateBeforeToday(next)) { setError("Selecciona una fecha y hora desde hoy."); return; }
        if (!navigator.onLine) { setError("Conéctate para reprogramar. La selección se mantiene."); return; }
        setBusy(true); setError(""); setResults([]);
        const outcome: typeof results = [];
        // Sequential writes give every record its own authorization/error and avoid flooding the API.
        for (const task of tasks) {
            try {
                const current = await TaskService.getTaskItem(task.id);
                await TaskService.updateTaskItem(task.id, taskReschedulePatch(current, next));
                outcome.push({ id: task.id, title: task.title });
            } catch (cause) { outcome.push({ id: task.id, title: task.title, error: cause instanceof Error ? cause.message : "No se pudo reprogramar." }); }
            setResults([...outcome]);
        }
        setBusy(false); onUpdated();
    };
    if (!tasks.length && !results.length) return null;
    return <section aria-label="Acciones para trabajos seleccionados" className="space-y-3 rounded-xl border border-accent/25 bg-accent/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{tasks.length} trabajos seleccionados</p><Button variant="ghost" size="sm" disabled={busy} onClick={() => { onClear(); setResults([]); }}>Quitar selección</Button></div><p className="text-xs text-muted-foreground">El nuevo inicio se aplica a cada selección y conserva su duración. Revisa los solapamientos en Calendario después de guardar.</p><div className="flex flex-col gap-2 sm:flex-row"><div className="min-w-0 flex-1"><DateTimePicker id="task-batch-start" aria-label="Nuevo inicio de los trabajos seleccionados" value={date} onValueChange={setDate} /></div><Button disabled={busy || !tasks.length} onClick={() => void submit()}>{busy ? "Guardando…" : "Reprogramar selección"}</Button></div>{error && <p role="alert" className="text-sm text-orange-700 dark:text-orange-300">{error}</p>}{results.length > 0 && <div role="status" className="text-sm"><p className="font-medium">{results.filter(row => !row.error).length} guardados · {results.filter(row => row.error).length} pendientes de corregir</p><ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">{results.map(row => <li key={row.id} className={row.error ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground"}>{row.title}: {row.error || "Reprogramado"}</li>)}</ul></div>}</section>;
}
