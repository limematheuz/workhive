"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataListTable } from "@/components/ui/data-list-table";
import { CompactFilterSelect } from "@/components/ui/compact-filter-select";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/user-context";
import { canManageCompanyTasks } from "@/domain/access/roles";
import { plannedDate, taskWorkers } from "@/domain/tasks/operations-overview";
import { attentionLabels, buildAttentionQueue, type AttentionReason } from "@/domain/tasks/operation-priorities";
import { TaskService } from "@/services/task.service";
import type { TaskItem } from "@/types/user";

export default function AlertsPage() {
    const { user, loading } = useUser();
    if (loading) return <p role="status">Cargando acceso…</p>;
    if (!canManageCompanyTasks(user)) return <p>No tienes permiso para consultar las alertas de operación.</p>;
    return <AlertsWorkspace key={`${user?.id}:${user?.company_id}`} />;
}
function AlertsWorkspace() {
    const [tasks, setTasks] = useState<TaskItem[] | null>(null), [failed, setFailed] = useState(false), [revision, refresh] = useState(0);
    const [reason, setReason] = useState("");
    useEffect(() => { let current = true; void TaskService.getAllTaskItems().then(items => { if (current) { setTasks(items); setFailed(false); } }).catch(() => { if (current) setFailed(true); }); return () => { current = false; }; }, [revision]);
    const rows = buildAttentionQueue(tasks ?? [], new Date()).filter(row => !reason || row.reasons.includes(reason as AttentionReason));
    const context = (task: TaskItem) => `${taskWorkers(task).map(worker => worker.name || `Trabajador #${worker.id}`).join(", ") || "Responsable pendiente"} · ${plannedDate(task)?.toLocaleString("es-ES", {dateStyle:"medium",timeStyle:"short"}) || "Fecha pendiente"}`;
    return <main className="dashboard-page-content space-y-4"><PageHeader icon={BellRing} title="Requiere tu atención" subtitle="Pendientes de la empresa activa, por prioridad y fecha. Cada trabajo aparece una vez con todos sus motivos." actions={<Button variant="outline" onClick={() => refresh(value => value + 1)}>Actualizar</Button>}/>
        {failed ? <div role="alert" className="rounded-xl border border-orange-400/40 p-4"><p>No se pudieron actualizar los pendientes.</p><Button variant="outline" onClick={() => refresh(value => value + 1)}>Reintentar</Button></div> : tasks === null ? <p role="status">Cargando pendientes…</p> : <><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><CompactFilterSelect aria-label="Motivo de atención" value={reason} onValueChange={setReason} options={[{value:"",label:"Todos los motivos"},...Object.entries(attentionLabels).map(([value,label])=>({value,label}))]}/></div><p className="text-sm text-muted-foreground">{rows.length} trabajos{reason ? " con este motivo" : " requieren una acción"}</p></div><DataListTable items={rows} getRowKey={row => row.task.id} persistenceKey="operation.alerts" columns={[{key:"work",label:"Trabajo",hideable:false},{key:"reason",label:"Qué requiere atención"},{key:"owner",label:"Responsable / fecha"},{key:"next",label:"Siguiente paso"}]} renderDesktopRow={row => [<Link key="work" className="font-medium text-accent hover:underline" href={`/dashboard?taskId=${row.task.id}`}>{row.task.title}</Link>,<span key="reason" className="text-sm text-orange-700 dark:text-orange-300">{row.reasons.map(value => attentionLabels[value]).join(" · ")}</span>,<span key="owner" className="text-xs text-muted-foreground">{context(row.task)}</span>,<Button key="next" asChild size="sm" variant="outline"><Link href={`/dashboard?taskId=${row.task.id}`}>Revisar trabajo</Link></Button>]} renderCompactRow={row => <Link className="block space-y-2" href={`/dashboard?taskId=${row.task.id}`}><p className="font-medium">{row.task.title}</p><p className="text-xs text-orange-700 dark:text-orange-300">{row.reasons.map(value => attentionLabels[value]).join(" · ")}</p><p className="text-xs text-muted-foreground">{context(row.task)}</p><span className="text-sm font-medium text-accent">Revisar trabajo →</span></Link>} empty={<p className="p-5 text-sm text-muted-foreground">{reason ? "No hay trabajos con este motivo. Prueba otro filtro." : "No hay pendientes en los registros disponibles."}</p>}/></>}
    </main>;
}
