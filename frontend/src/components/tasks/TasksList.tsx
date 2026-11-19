"use client";
import React from "react";
import type { TaskItem } from "@/services/task.service";
import type { Location } from "@/services/location.service";
import type { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import { useViewState } from "@/hooks/useViewState";
import { useTaskQueryState } from "@/hooks/useTaskQueryState";
import { SavedViewsControl } from "@/components/ui/saved-views-control";
import { Button } from "@/components/ui/button";
import { TASK_VIEW_FILTER_KEYS, taskViewFilter } from "@/domain/tasks/task-view-filters";
import { taskDeadlinePassed,taskCompletedThisWeek } from "@/domain/tasks/task-summary";
import { isTaskAssignedToUser } from "@/lib/format";
import { taskWorkers } from "@/domain/tasks/operations-overview";
import { filterTasksForGeneralList, getTaskListDisplayStatus, type TaskListDateScope } from "./tasksListUtils";
import { TasksListFilters } from "./TasksListFilters";
import { TaskListCard } from "./TaskListCard";
import { TasksListTable } from "./TasksListTable";
import { TaskBatchSchedule } from "./TaskBatchSchedule";
import { TasksListInsights } from "./TasksListInsights";
interface TasksListProps {
    onTasksChanged: () => void;
    error?:string|null;
    dict: Dictionary;
    tasks: TaskItem[];
    locations: Location[];
    users: User[];
    isAdminOrManager: boolean;
    currentUser: User | null;
    loadingTasks: boolean;
    selectedLocationId: string;
    setSelectedLocationId: (val: string) => void;
    selectedUserId: string;
    setSelectedUserId: (val: string) => void;
    selectedStatus: string;
    setSelectedStatus: (val: string) => void;
    handleOpenDetail: (task: TaskItem) => void;
    handleToggleStatus: (task: TaskItem, e: React.MouseEvent) => void;
    getLocationName: (locId: number) => string;
    getAssigneeName: (userId: number | null) => string;
}

export function TasksList(props: TasksListProps) {
    const { dict, tasks, locations, users, currentUser, isAdminOrManager, loadingTasks, selectedLocationId, setSelectedLocationId, selectedUserId, setSelectedUserId, selectedStatus, setSelectedStatus, handleOpenDetail, handleToggleStatus, getLocationName, getAssigneeName, onTasksChanged } = props;
    const [searchQuery, setSearchQuery] = useTaskQueryState("query");
    const [date, setDate] = useTaskQueryState("date", "ALL");
    const [selectedPriority, setSelectedPriority] = useTaskQueryState("priority");
    const [attention, setAttention] = useTaskQueryState("attention");
    const [completedOpen, setCompletedOpen] = useViewState("tasks.completedOpen", false);
    const [selected, setSelected] = React.useState<number[]>([]);
    const filtered = filterTasksForGeneralList(tasks, { query: searchQuery, dateScope: date as TaskListDateScope, priority: selectedPriority, getLocationName, getAssigneeName });
    const visible = filtered.filter(task => (!selectedLocationId || task.location_id===Number(selectedLocationId)) && (!selectedUserId || isTaskAssignedToUser(task,Number(selectedUserId))) && (!selectedStatus || (selectedStatus === "pending" ? task.status === "pending" : getTaskListDisplayStatus(task.status) === selectedStatus))
        && (attention !== "late" || taskDeadlinePassed(task, new Date()))
        && (attention !== "completed-week" || taskCompletedThisWeek(task,new Date()))
        && (attention !== "unassigned" || !taskWorkers(task).length)
        && (selectedStatus || completedOpen || task.status !== "completed"));
    const canSelect = (task: TaskItem) => isAdminOrManager && !task.is_invoiced && !["completed", "cancelled", "requested", "rejected"].includes(task.status)
        && locations.find(location => location.id === task.location_id)?.can_manage_tasks === true;
    const selection = visible.filter(task => selected.includes(task.id) && canSelect(task));
    const clear = () => { setSearchQuery(""); setDate("ALL"); setSelectedPriority(""); setAttention(""); setSelectedStatus(""); setSelectedLocationId(""); setSelectedUserId(""); };
    const hasFilters=Boolean(searchQuery||selectedLocationId||selectedUserId||selectedStatus||selectedPriority||attention||date!=="ALL");
    const filters = { query: searchQuery, date, priority: selectedPriority, status: selectedStatus, location: selectedLocationId, worker: selectedUserId, tab: "list", attention };
    const apply = (values: Record<string, string>) => {
        setSearchQuery(taskViewFilter("query", values.query || "")); setDate(taskViewFilter("date", values.date || "ALL")); setSelectedPriority(taskViewFilter("priority", values.priority || ""));
        setSelectedStatus(taskViewFilter("status", values.status || "")); setSelectedLocationId(taskViewFilter("location", values.location || "")); setSelectedUserId(taskViewFilter("worker", values.worker || "")); setAttention(taskViewFilter("attention", values.attention || ""));
    };
    if(props.error) return <p role="status" className="rounded-xl border p-5 text-sm text-muted-foreground">Información no disponible. Reintenta la carga para consultar los indicadores y los trabajos.</p>;
    return <div className="space-y-4">
        {!loadingTasks && <TasksListInsights tasks={tasks} onFilter={(kind) => { clear(); setSelectedStatus(kind === "completed-week" ? "completed" : kind === "pending" || kind === "progress" ? kind : ""); setAttention(kind === "late" || kind === "unassigned" || kind === "completed-week" ? kind : ""); }} onOpen={handleOpenDetail} />}
        <TasksListFilters dict={dict} totalItems={loadingTasks ? 0 : visible.length} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} selectedLocationId={selectedLocationId} onSelectedLocationIdChange={setSelectedLocationId} locations={locations} isAdminOrManager={isAdminOrManager} selectedUserId={selectedUserId} onSelectedUserIdChange={setSelectedUserId} users={users} selectedStatus={selectedStatus} onSelectedStatusChange={setSelectedStatus} selectedPriority={selectedPriority} onSelectedPriorityChange={setSelectedPriority} dateScope={date} onDateScopeChange={setDate} />
        <div className="flex flex-wrap items-center gap-2"><SavedViewsControl viewKey="tasks.list" tableKey="tasks.list" filterKeys={TASK_VIEW_FILTER_KEYS} filters={filters} onApply={apply}/>{hasFilters&&<Button variant="ghost" size="sm" onClick={clear}>Limpiar filtros</Button>}{!selectedStatus && <Button variant="outline" size="sm" onClick={() => setCompletedOpen(!completedOpen)} aria-pressed={completedOpen}>{completedOpen ? "Ocultar completados" : "Incluir completados"}</Button>}{attention && <Button variant="outline" size="sm" onClick={() => setAttention("")}>{attention === "late" ? "Vencidas" : attention === "completed-week" ? "Completadas esta semana" : "Sin asignar"} ×</Button>}</div>
        <div aria-label="Filtros activos" className="flex flex-wrap gap-2">{[{key:"query",value:searchQuery,label:`Búsqueda: ${searchQuery}`,clear:()=>setSearchQuery("")},{key:"location",value:selectedLocationId,label:`Ubicación: ${selectedLocationId?getLocationName(Number(selectedLocationId)):""}`,clear:()=>setSelectedLocationId("")},{key:"worker",value:selectedUserId,label:`Responsable: ${selectedUserId?getAssigneeName(Number(selectedUserId)):""}`,clear:()=>setSelectedUserId("")},{key:"status",value:selectedStatus,label:`Estado: ${selectedStatus}`,clear:()=>setSelectedStatus("")},{key:"priority",value:selectedPriority,label:`Prioridad: ${selectedPriority}`,clear:()=>setSelectedPriority("")},{key:"date",value:date!=="ALL"?date:"",label:date==="PAST"?"Fechas anteriores":"Próximas fechas",clear:()=>setDate("ALL")}].filter(chip=>chip.value).map(chip=><Button key={chip.key} variant="outline" size="sm" aria-label={`Quitar filtro ${chip.label}`} onClick={chip.clear}>{chip.label} ×</Button>)}</div>
        <TaskBatchSchedule tasks={selection} onUpdated={onTasksChanged} onClear={() => setSelected([])}/>
        {loadingTasks ? <p role="status" className="p-8 text-sm text-muted-foreground">Cargando trabajos…</p> : <TasksListTable onUpdated={onTasksChanged} tasks={visible} locationName={getLocationName} workerName={getAssigneeName} onOpen={handleOpenDetail} selected={selected} canSelect={canSelect} onSelect={(id, checked) => setSelected(current => checked ? [...new Set([...current,id])] : current.filter(value => value !== id))} compact={(task,open) => <TaskListCard dict={dict} task={task} locations={locations} currentUser={currentUser} isAdminOrManager={isAdminOrManager} handleOpenDetail={open} handleToggleStatus={handleToggleStatus} getAssigneeName={getAssigneeName} getLocationName={getLocationName}/>} />}
    </div>;
}
