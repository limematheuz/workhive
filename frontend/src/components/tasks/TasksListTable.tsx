import { useEffect, useMemo, useRef, useState } from "react";
import { useListAppearance } from "@/hooks/useListAppearance";
import { orderedListItems } from "@/lib/list-appearance";
import { useTaskReview } from "@/hooks/useTaskReview";
import { TaskConsultationCard } from "./TaskConsultationCard";
import { Dialog,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { DataListTable } from "@/components/ui/data-list-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { taskMoment } from "@/domain/tasks/task-moment";
import { taskWorkers } from "@/domain/tasks/operations-overview";
import type { TaskItem } from "@/types/user";
import type { ReactNode } from "react";

const statuses: Record<string, string> = { pending: "Pendiente", accepted: "Aceptado", progress: "En curso", in_progress: "En curso", review: "En revisión", in_review: "En revisión", completed: "Completado" };
export function TasksListTable({ tasks, locationName, workerName, onOpen, compact, selected, onSelect, canSelect, onUpdated, persistenceKey = "tasks.list" }: {
    tasks: TaskItem[]; locationName: (id: number) => string; workerName: (id: number | null) => string;
    onOpen: (task: TaskItem) => void; compact: (task: TaskItem, onOpen: (task:TaskItem)=>void) => ReactNode;
    onUpdated:()=>void;
    selected: number[]; onSelect: (id: number, checked: boolean) => void; canSelect: (task: TaskItem) => boolean; persistenceKey?: string;
}) {
    const sortOptions = useMemo(() => [
        { value: "schedule", label: "Fecha límite", compare: (a: TaskItem, b: TaskItem) => (a.due_at?new Date(a.due_at).getTime():Infinity) - (b.due_at?new Date(b.due_at).getTime():Infinity) || a.id - b.id },
        { value: "title", label: "Nombre del servicio", compare: (a: TaskItem, b: TaskItem) => a.title.localeCompare(b.title, "es") },
    ], []);
    const {appearance}=useListAppearance(persistenceKey,[]);
    const ordered=orderedListItems(tasks,sortOptions.find(option=>option.value===appearance.sort)?.compare);
    const container=useRef<HTMLDivElement>(null);
    const review=useTaskReview(ordered,onUpdated,taskId=>{
        const markers=container.current?.querySelectorAll<HTMLElement>(`[data-task-review-id="${taskId}"]`)??[];
        for(const marker of markers){const trigger=marker.closest<HTMLElement>('tr[tabindex], [data-slot="card"][role="button"]');if(trigger?.getClientRects().length)return trigger;}
        return null;
    });
    const [wide,setWide]=useState(false);
    useEffect(()=>{const element=container.current;if(!element)return;const observer=new ResizeObserver(entries=>setWide(entries[0].contentRect.width>=936));observer.observe(element);return()=>observer.disconnect();},[]);
    const card=review.record?<TaskConsultationCard review={review} items={ordered} locationName={locationName} workerName={workerName} canEdit={canSelect(review.record)} onFullDetail={onOpen}/>:null;
    const selection = (task: TaskItem) => canSelect(task) ? <span onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}><Checkbox aria-label={`Seleccionar ${task.title} para reprogramar`} checked={selected.includes(task.id)} onCheckedChange={checked => onSelect(task.id, checked === true)} /></span> : <span className="sr-only">Sin acciones masivas disponibles</span>;
    return <div ref={container}><p role="status" className="sr-only">{review.notice}</p><div style={wide&&card?{display:"grid",gridTemplateColumns:"minmax(560px,1fr) 360px",gap:16,alignItems:"start"}:undefined}><div className="min-w-0"><DataListTable items={ordered} getRowKey={task => task.id} persistenceKey={persistenceKey} customizable selectedRowKey={review.record?.id} sortOptions={sortOptions} onRowClick={review.select} rowAriaLabel={task => `Abrir ${task.title}`} columns={[
        { key: "selection", label: "", labelText: "Selección", hideable: false, className: "w-10" }, { key: "service", label: "Servicio y ubicación", hideable: false },
        { key: "date", label: "Fecha límite" }, { key: "worker", label: "Responsables" }, { key: "status", label: "Estado" },
    ]} renderDesktopRow={task => [<span key="selection" data-task-review-id={task.id}>{selection(task)}</span>, <div key="service"><p className="font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{locationName(task.location_id)}</p></div>, <span key="date" className={task.due_at ? "text-sm" : "text-sm text-orange-700 dark:text-orange-300"}>{taskMoment(task.due_at)}</span>, <span key="worker" className="text-sm">{taskWorkers(task).map(worker => worker.name || workerName(worker.id)).join(", ") || "Sin asignar"}</span>, <Badge key="status" variant="secondary">{statuses[task.status] || "Pendiente"}</Badge>]} renderCompactRow={task => <div data-task-review-id={task.id} className="space-y-2">{selection(task)}{compact(task,review.select)}</div>} empty={<p className="p-5 text-sm text-muted-foreground">No hay trabajos con estos filtros. Cambia la búsqueda o limpia los filtros.</p>} /></div>{wide&&card&&<aside className="sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto">{card}</aside>}</div><Dialog open={!wide&&Boolean(card)} onOpenChange={open=>{if(!open)review.select(null);}}><DialogContent confirmDiscard={false} showCloseButton={false} onCloseAutoFocus={event=>{event.preventDefault();if(!review.record)review.restoreFocus();}} className="h-[100dvh] max-h-[100dvh] w-screen max-w-none overflow-y-auto rounded-none p-0 sm:max-w-none"><DialogHeader className="sr-only"><DialogTitle>Detalle de trabajo</DialogTitle></DialogHeader>{!wide&&card}</DialogContent></Dialog></div>;
}
