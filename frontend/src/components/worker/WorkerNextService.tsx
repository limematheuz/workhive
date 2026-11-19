import Link from "next/link";
import {cleanChecklistDescription} from "@/lib/format";
import { ArrowRight, Clock3, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskItem } from "@/types/user";
import { workerChecklistProgress } from "@/domain/tasks/worker-day";
import { isTaskDateOnlyValue } from "@/domain/tasks/task-schedule";
import { useWorkerWorkspace } from "./WorkerWorkspace";

export function WorkerNextService({ task, userId }: { task: TaskItem | null; userId: number }) {
    const { locations, locationName, openTask, online } = useWorkerWorkspace();
    const location = locations.find(row => row.id === task?.location_id);
    const progress = task ? workerChecklistProgress(task, userId) : null;
    const formatter = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
    const start = task?.scheduled_start_at && !isTaskDateOnlyValue(task.scheduled_start_at) ? formatter.format(new Date(task.scheduled_start_at)) : null;
    const end = task?.due_at && !isTaskDateOnlyValue(task.due_at) ? formatter.format(new Date(task.due_at)) : null;
    return <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="worker-next-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="worker-next-title" className="text-sm font-medium text-muted-foreground">Tu siguiente paso</h2><Button asChild variant="outline" size="sm"><Link href="/worker/clock"><Clock3 aria-hidden="true" className="size-4" />Mi fichaje</Link></Button></div>
        {task ? <><div><p className={start ? "text-sm font-semibold text-accent" : "text-sm font-medium text-orange-700 dark:text-orange-300"}>{start ? `${start}${end ? ` – ${end}` : " · Fin pendiente"}` : "Horario pendiente de confirmar"}</p><h3 className="mt-1 break-words text-xl font-semibold tracking-tight">{task.title}</h3><p className="mt-2 flex items-start gap-2 text-sm"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{locationName(task.location_id)}{location?.address && <span className="mt-1 block text-muted-foreground">{location.address}</span>}</span></p></div>
            {task.description && <p className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{cleanChecklistDescription(task.description)}</p>}
            <div className="flex flex-wrap items-center gap-3"><p className="flex-1 text-sm">{progress?.total ? `${progress.total - progress.done} tareas propias pendientes · ${progress.done}/${progress.total} completadas` : "Checklist pendiente de preparar"}</p><Button className="w-full sm:w-auto" disabled={!online} onClick={() => openTask(task)}>Abrir trabajo<ArrowRight aria-hidden="true" className="size-4" /></Button></div>{!online && <p className="text-xs text-orange-700 dark:text-orange-300">Sin conexión. Registra el avance desde los partes guardados en este dispositivo.</p>}</> : <p className="text-sm text-muted-foreground">No tienes trabajos pendientes para hoy. Consulta los próximos días o revisa tu fichaje.</p>}
    </section>;
}
