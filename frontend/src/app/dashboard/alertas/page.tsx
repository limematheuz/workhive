"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-context";
import { canManageCompanyTasks } from "@/domain/access/roles";
import { buildOperationsOverview, overviewRange } from "@/domain/tasks/operations-overview";
import { TaskService } from "@/services/task.service";
import type { TaskItem } from "@/types/user";

export default function AlertsPage() {
    const {user,loading} = useUser();
    const [tasks,setTasks] = useState<TaskItem[] | null>(null);
    const [failed,setFailed] = useState(false);
    const [revision,refresh] = useState(0);
    const allowed = canManageCompanyTasks(user);
    useEffect(() => {
        let current = true;
        if (allowed) TaskService.getAllTaskItems().then(items => {
            if (current) { setTasks(items); setFailed(false); }
        }).catch(() => { if (current) setFailed(true); });
        return () => { current = false; };
    },[allowed,user?.company_id,user?.id,revision]);
    if (loading) return <p>Cargando…</p>;
    if (!allowed) return <p>Acceso restringido.</p>;
    const now = new Date();
    const data = buildOperationsOverview(tasks || [], overviewRange("today","",now),now);
    const sections = [
        {label:"Hora de inicio superada",items:data.late},
        {label:"Sin responsable hoy",items:data.unassigned},
        {label:"Pendientes de días anteriores",items:data.carriedOver},
        {label:"Pendientes de revisión hoy",items:data.review},
        {label:"Sin programar",items:data.unscheduled},
        {label:"Terminados sin facturar",items:(tasks||[]).filter(task=>task.status==="completed"&&!task.is_invoiced)},
    ];
    return <div className="dashboard-page-content space-y-3"><PageHeader icon={BellRing} title="Pendientes y alertas" subtitle="Selecciona una tarea para revisar su estado." actions={<Button variant="outline" onClick={()=>refresh(n=>n+1)}>Actualizar</Button>}/>
        {failed ? <p role="alert">No se pudieron cargar las tareas. Pulsa Actualizar para reintentar.</p> : tasks === null ? <p>Cargando tareas…</p> :
        sections.map(({label,items})=><details key={label} open={items.length>0 || undefined} className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-card)] p-3">
            <summary className="cursor-pointer font-semibold">{label} <span className={items.length?"text-orange-700 dark:text-orange-300":"text-[var(--text-muted)]"}>{items.length}</span></summary>
            {items.length ? <ul className="mt-2 divide-y">{items.map(task=><li key={task.id}><Link className="block py-2 text-sm text-accent hover:underline" href={`/dashboard?taskId=${task.id}`}>{task.title}</Link></li>)}</ul> : <p className="mt-2 text-xs">Sin pendientes.</p>}
        </details>)}
    </div>;
}
