"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TaskService, type TaskItem } from "@/services/task.service";
import {taskMoment} from "@/domain/tasks/task-moment";
import { plannedDate, overviewStatus, taskWorkers } from "@/domain/tasks/operations-overview";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";

export function LocationUpcomingServices({ locationId }: { locationId: number }) {
    const { user } = useUser();
    const scope = `${user?.id}:${user?.company_id}:${locationId}`;
    const [data, setData] = useState<{ scope: string; tasks: TaskItem[]; error?: string } | null>(null);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let current = true;
        void TaskService.getAllTaskItems({ locationId }).then(tasks => { if (current) setData({ scope, tasks }); }).catch(() => { if (current) setData({ scope, tasks: [], error: "No se pudieron consultar los servicios de esta ubicación." }); });
        return () => { current = false; };
    }, [locationId, scope, revision]);
    const visible = data?.scope === scope ? data : null;
    const tasks = visible?.tasks.filter(task => !["completed", "cancelled"].includes(overviewStatus(task)) && plannedDate(task)).sort((a, b) => plannedDate(a)!.getTime() - plannedDate(b)!.getTime()) ?? [];
    return <section className="mt-4 rounded-xl border p-4"><h3 className="text-sm font-semibold">Próximos servicios y pendientes</h3>{!visible ? <p role="status" className="mt-2 text-sm text-muted-foreground">Cargando servicios…</p> : visible.error ? <div role="alert" className="mt-2 text-sm"><p>{visible.error}</p><Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>Reintentar</Button></div> : tasks.length ? <ul className="mt-2 divide-y">{tasks.slice(0, 4).map(task => <li key={task.id}><Link href={`/dashboard?taskId=${task.id}`} className="block rounded-lg py-3 text-sm hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"><span className="font-medium">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{taskMoment(task.scheduled_start_at||task.due_at)} · {taskWorkers(task).map(worker => worker.name || `Trabajador #${worker.id}`).join(", ") || "Responsable pendiente"}</span></Link></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No hay servicios programados pendientes.</p>}</section>;
}
