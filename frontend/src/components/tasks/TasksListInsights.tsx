import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { taskDeadlinePassed,taskCompletedThisWeek } from "@/domain/tasks/task-summary";
import { overviewStatus } from "@/domain/tasks/operations-overview";
import { addDays, startOfLocalDay } from "@/domain/tasks/task-schedule";
import type { TaskItem } from "@/types/user";

export function TasksListInsights({ tasks, onFilter, onOpen }: { tasks: TaskItem[]; onFilter: (kind: string) => void; onOpen: (task: TaskItem) => void }) {
    const [list, setList] = useState<{ title: string; tasks: TaskItem[] } | null>(null);
    const now = new Date();
    const metrics = [
        { kind: "pending", label: "Pendientes", count: tasks.filter(task => task.status === "pending").length },
        { kind: "progress", label: "En curso", count: tasks.filter(task => overviewStatus(task) === "progress").length },
        { kind: "late", label: "Vencidas", count: tasks.filter(task => taskDeadlinePassed(task, now)).length },
        { kind: "completed-week", label: "Completadas esta semana", count: tasks.filter(task => taskCompletedThisWeek(task, now)).length },
    ];
    const days = Array.from({ length: 7 }, (_, index) => {
        const day = addDays(startOfLocalDay(now), index - 6), end = addDays(day, 1);
        const inDay = (value?: string | null) => value && new Date(value) >= day && new Date(value) < end;
        return { day, created: tasks.filter(task => inDay(task.created_at)), completed: tasks.filter(task => inDay(task.date_done)) };
    });
    const max = Math.max(1, ...days.flatMap(day => [day.created.length, day.completed.length]));
    return <div className="space-y-3"><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{metrics.map(metric => <Button key={metric.kind} type="button" variant="outline" onClick={() => onFilter(metric.kind)} className="h-auto flex-col items-start gap-1 rounded-xl border-[var(--border-color)] bg-card p-4 text-left"><span className="text-sm font-normal text-muted-foreground">{metric.label}</span><strong className={`block text-[30px] font-semibold leading-9 ${metric.count && ["late","unassigned"].includes(metric.kind) ? "text-orange-700 dark:text-orange-300" : ""}`}>{metric.count}</strong><span className="text-sm font-normal text-accent">Ver tareas</span></Button>)}</div><p className="text-xs text-muted-foreground">Totales del ámbito autorizado, antes de los filtros del listado. La semana empieza el lunes en la zona horaria del dispositivo.</p>
        <details className="rounded-xl border bg-card p-3"><summary className="cursor-pointer text-sm font-medium">Actividad de los últimos 7 días</summary><p className="mt-2 text-xs text-muted-foreground">Creadas y completadas por su fecha registrada, dentro del ámbito autorizado. Pulsa una barra para ver sus trabajos.</p><div className="mt-3 grid grid-cols-7 gap-2">{days.map(day => <div key={day.day.toISOString()} className="min-w-0 space-y-1"><div className="flex h-20 items-end justify-center gap-1">{(["created","completed"] as const).map(kind => <button key={kind} type="button" aria-label={`${day.day.toLocaleDateString("es-ES")}: ${day[kind].length} ${kind === "created" ? "creadas" : "completadas"}`} onClick={() => setList({ title: `${kind === "created" ? "Creadas" : "Completadas"} · ${day.day.toLocaleDateString("es-ES")}`, tasks: day[kind] })} className={`min-h-2 w-6 rounded-t focus-visible:outline-2 focus-visible:outline-accent ${kind === "created" ? "bg-accent/30" : "bg-accent"}`} style={{ height: `${Math.max(10, day[kind].length / max * 100)}%` }}><span className="sr-only">{day[kind].length}</span></button>)}</div><p className="text-center text-[10px] text-muted-foreground">{day.day.toLocaleDateString("es-ES",{day:"numeric",month:"short"})}</p></div>)}</div><p className="mt-2 text-xs text-muted-foreground">Claro: creadas · Oscuro: completadas. Sin fecha de finalización no se atribuye una finalización a un día.</p></details>
        <Dialog open={Boolean(list)} onOpenChange={open => { if (!open) setList(null); }}><DialogContent><DialogHeader><DialogTitle>{list?.title}</DialogTitle><DialogDescription>{list?.tasks.length ?? 0} trabajos</DialogDescription></DialogHeader><div className="max-h-80 space-y-1 overflow-y-auto">{list?.tasks.map(task => <Button key={task.id} variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { setList(null); onOpen(task); }}>{task.title}</Button>)}{!list?.tasks.length && <p className="text-sm text-muted-foreground">No hay registros en este día.</p>}</div></DialogContent></Dialog>
    </div>;
}
