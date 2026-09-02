"use client";

import { ChevronRight, MapPin, Search, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";

type ClientDetailTasksTabProps = { filteredTasks: TaskItem[]; locations: Location[]; taskSearch: string; onTaskSearchChange: (value: string) => void; taskStatusFilter: string; onTaskStatusFilterChange: (value: string) => void; getAssigneeName: (userId: number | null) => string; labels: { search_task?: string; all_statuses?: string; status_pending?: string; status_in_progress?: string; status_completed?: string; no_tasks?: string; task?: string; assignment?: string; open_task?: string; }; onViewTaskDetails: (task: TaskItem) => void; onClose: () => void; };

export function ClientDetailTasksTab(props: ClientDetailTasksTabProps) {
    const { filteredTasks, locations, taskSearch, onTaskSearchChange, taskStatusFilter, onTaskStatusFilterChange, getAssigneeName, labels, onViewTaskDetails, onClose } = props;
    const pagination = useDataTablePagination(filteredTasks, 10);
    const openTask = (task: TaskItem) => { onClose(); onViewTaskDetails(task); };
    return <section className="billing-surface overflow-hidden rounded-[22px]">
        <div className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/25 p-4 sm:p-5"><div className="flex flex-col gap-2 sm:flex-row"><label className="relative min-w-0 flex-1"><span className="sr-only">{labels.search_task}</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" /><Input type="search" placeholder={labels.search_task || "Buscar trabajo"} value={taskSearch} onChange={(event) => onTaskSearchChange(event.target.value)} className="h-10 bg-[var(--bg-primary)]/65 pl-9" /></label><Select value={taskStatusFilter} onValueChange={onTaskStatusFilterChange}><SelectTrigger className="h-10 w-full bg-[var(--bg-primary)]/65 sm:w-52" aria-label={labels.all_statuses}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{labels.all_statuses || "Todos los estados"}</SelectItem><SelectItem value="pending">{labels.status_pending || "Pendientes"}</SelectItem><SelectItem value="progress">{labels.status_in_progress || "En curso"}</SelectItem><SelectItem value="completed">{labels.status_completed || "Completadas"}</SelectItem></SelectContent></Select></div></div>
        {filteredTasks.length === 0 ? <p className="px-5 py-16 text-center text-sm text-[var(--text-muted)]">{labels.no_tasks || "No hay trabajos con estos filtros."}</p> : <><Table className="min-w-[46rem] table-fixed text-left"><TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--btn-secondary-text)]"><TableHead className="w-[42%] text-[var(--btn-secondary-text)]">{labels.task || "Trabajo"}</TableHead><TableHead className="w-[27%] text-[var(--btn-secondary-text)]">{labels.assignment || "Asignación"}</TableHead><TableHead className="w-[18%] text-right text-[var(--btn-secondary-text)]">Estado</TableHead><TableHead className="w-[13%] text-right text-[var(--btn-secondary-text)]">Acciones</TableHead></TableRow></TableHeader><TableBody>{pagination.pageItems.map((task) => <TaskRow key={task.id} task={task} locations={locations} getAssigneeName={getAssigneeName} labels={labels} onOpen={() => openTask(task)} />)}</TableBody></Table><DataTablePagination page={pagination.page} totalItems={filteredTasks.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${(pagination.page - 1) * pagination.pageSize + 1}-${Math.min(pagination.page * pagination.pageSize, filteredTasks.length)} de ${filteredTasks.length} trabajos`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" /></>}
    </section>;
}

function TaskRow({ task, locations, getAssigneeName, labels, onOpen }: { task: TaskItem; locations: Location[]; getAssigneeName: (userId: number | null) => string; labels: ClientDetailTasksTabProps["labels"]; onOpen: () => void }) {
    const taskLocation = locations.find((location) => location.id === task.location_id);
    const statusLabel = task.status === "completed" ? (labels.status_completed || "Completada") : task.status === "progress" ? (labels.status_in_progress || "En curso") : (labels.status_pending || "Pendiente");
    const statusClassName = task.status === "completed" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : task.status === "progress" ? "border border-accent/20 bg-accent/10 text-accent" : "border border-orange-500/20 bg-orange-500/10 text-orange-600";
    return <TableRow className="bg-[var(--bg-secondary)]/20"><TableCell><p className="truncate text-sm font-semibold text-[var(--text-main)]">{task.title}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><MapPin className="size-3 text-accent" />{taskLocation?.name || `#${task.location_id}`}</p></TableCell><TableCell><p className="flex items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><UserCheck className="size-3.5 text-accent" />{getAssigneeName(task.user_id)}</p></TableCell><TableCell className="text-right"><Badge className={`text-[9px] font-bold uppercase ${statusClassName}`}>{statusLabel}</Badge></TableCell><TableCell className="text-right"><Button type="button" variant="outline" size="icon-xs" onClick={onOpen} aria-label={labels.open_task || "Abrir trabajo"}><ChevronRight /></Button></TableCell></TableRow>;
}
