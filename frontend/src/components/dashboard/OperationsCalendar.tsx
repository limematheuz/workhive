"use client";

import React from "react";
import {
    CheckCheck,
    ClipboardList,
    MapPin,
    Plus,
    Search,
    Timer,
    TriangleAlert,
    User as UserIcon,
} from "lucide-react";
import { TaskItem, User } from "@/types/user";
import { Location } from "@/types/location";
import { useOperationsCalendar } from "@/hooks/useOperationsCalendar";
import { CalendarKanbanCard } from "./CalendarKanbanCard";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { isExternalTaskForCompany } from "@/lib/task-display";

interface OperationsCalendarProps {
    tasks: TaskItem[];
    locations: Location[];
    users: User[];
    onTaskUpdate: () => void;
    currentUser: User | null;
    onCreateTask?: () => void;
}

export function OperationsCalendar({
    tasks,
    locations,
    users,
    onTaskUpdate,
    currentUser,
    onCreateTask,
}: OperationsCalendarProps) {
    const state = useOperationsCalendar({
        tasks,
        locations,
        users,
        onTaskUpdate,
        currentUser,
    });

    const kanbanColumns = [
        {
            id: "pending" as const,
            title: state.dict.tasks.kanban?.col_pending || "Pendientes",
            icon: TriangleAlert,
            tone: "text-orange-600",
            badge: "bg-orange-500 text-white font-extrabold shadow-xs",
            ring: "border-orange-500/35 bg-orange-500/5",
            tasks: state.columnsTasks.pending,
            empty: state.dict.tasks.kanban?.no_pending || "Sin tareas pendientes",
        },
        {
            id: "progress" as const,
            title: state.dict.tasks.kanban?.col_progress || "En Progreso",
            icon: Timer,
            tone: "text-accent",
            badge: "bg-accent text-white font-extrabold shadow-xs",
            ring: "border-accent/35 bg-accent/5",
            tasks: state.columnsTasks.progress,
            empty: state.dict.tasks.kanban?.no_progress || "Arrastra tareas aquí para iniciar",
        },
        {
            id: "completed" as const,
            title: state.dict.tasks.kanban?.col_completed || "Completadas",
            icon: CheckCheck,
            tone: "text-emerald-600",
            badge: "bg-emerald-500 text-white font-extrabold shadow-xs",
            ring: "border-emerald-500/35 bg-emerald-500/5",
            tasks: state.columnsTasks.completed,
            empty: state.dict.tasks.kanban?.no_completed || "Sin tareas completadas",
        },
    ];

    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-4 md:p-6 shadow-xl flex flex-col space-y-5 overflow-hidden">
            <PageHeader
                icon={ClipboardList}
                title={state.dict.tasks.kanban?.title || "Tablero Operativo"}
                subtitle={state.dict.tasks.kanban?.subtitle || "Planifica, asigna y mueve el trabajo por estados con una vista visual de operaciones."}
                titleAs="h2"
                className="border-[var(--border-soft)]"
                actions={state.isAdminOrManager && onCreateTask ? (
                    <button
                        type="button"
                        onClick={onCreateTask}
                        className="h-10 px-4 rounded-xl bg-[var(--text-main)] text-[var(--text-inverse)] text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        {state.dict.tasks?.new_task || "Nueva Tarea"}
                    </button>
                ) : undefined}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr_0.8fr] gap-3 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-3">
                <div className="relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                        type="text"
                        placeholder={state.dict.tasks.kanban?.search_placeholder || "Buscar tarea por título o descripción..."}
                        value={state.searchQuery}
                        onChange={(e) => state.setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/40 transition-colors"
                    />
                </div>

                <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <select
                        value={state.selectedUserId}
                        onChange={(e) => state.setSelectedUserId(e.target.value)}
                        aria-label={state.dict.tasks.kanban?.all_operators || "Todos los operarios"}
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/40 transition-colors"
                    >
                        <option value="ALL">{state.dict.tasks.kanban?.all_operators || "Todos los operarios"}</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id.toString()}>
                                {u.full_name || u.email}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <select
                        value={state.selectedLocationId}
                        onChange={(e) => state.setSelectedLocationId(e.target.value)}
                        aria-label={state.dict.tasks.kanban?.all_locations || "Todas las ubicaciones"}
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/40 transition-colors"
                    >
                        <option value="ALL">{state.dict.tasks.kanban?.all_locations || "Todas las ubicaciones"}</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id.toString()}>
                                {loc.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex overflow-x-auto gap-4 pt-1 pb-2 xl:grid xl:grid-cols-3 xl:overflow-x-visible">
                {kanbanColumns.map((column) => {
                    const Icon = column.icon;
                    const isActiveDrop = state.dragOverColumn === column.id;

                    return (
                        <div
                            key={column.id}
                            onDragOver={(e) => state.handleDragOver(e, column.id)}
                            onDragLeave={state.handleDragLeave}
                            onDrop={(e) => state.handleDrop(e, column.id)}
                            className={`flex flex-col min-h-[520px] rounded-3xl border p-3 ui-motion duration-200 bg-[var(--bg-secondary)] w-[280px] sm:w-[320px] shrink-0 xl:w-full xl:shrink ${
                                isActiveDrop ? column.ring : "border-[var(--border-soft)]"
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3 px-1 pb-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Icon className={`w-4 h-4 ${column.tone} shrink-0`} />
                                    <h3 className="text-sm font-bold text-[var(--text-main)] truncate">
                                        {column.title}
                                    </h3>
                                    <span className={`text-2xs rounded-full px-2 py-0.5 font-bold ${column.badge}`}>
                                        {column.tasks.length}
                                    </span>
                                </div>
                                {state.isAdminOrManager && onCreateTask && (
                                    <button
                                        type="button"
                                        onClick={onCreateTask}
                                        className="w-8 h-8 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors cursor-pointer"
                                        aria-label={`Add task to ${column.title}`}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                                {column.tasks.length === 0 ? (
                                    <div className="h-36 border border-dashed border-[var(--border-color)] rounded-2xl flex items-center justify-center text-xs font-semibold text-[var(--text-muted)] text-center p-4 bg-white/20">
                                        {column.empty}
                                    </div>
                                ) : (
                                    column.tasks.map(task => {
                                        const loc = locations.find(l => l.id === task.location_id);
                                        const ownerCompanyId = loc?.owner_company_id ?? loc?.managing_company_id;
                                        const isExternal = isExternalTaskForCompany(task, currentUser?.company_id)
                                            || Boolean(ownerCompanyId && ownerCompanyId !== currentUser?.company_id);
                                        return (
                                            <CalendarKanbanCard
                                                key={task.id}
                                                task={task}
                                                updating={state.updatingTaskId === task.id}
                                                getUserInitials={state.getUserInitials}
                                                getUserFullName={state.getUserFullName}
                                                getLocationName={state.getLocationName}
                                                onDragStart={state.handleDragStart}
                                                onClick={state.handleOpenDetail}
                                                isExternal={isExternal}
                                                canDrag={state.isAdminOrManager}
                                            />
                                        );
                                    })
                                )}
                            </div>

                            {state.isAdminOrManager && onCreateTask && (
                                <button
                                    type="button"
                                    onClick={onCreateTask}
                                    className="mt-3 h-11 rounded-2xl border border-dashed border-accent/55 bg-accent/5 text-accent text-sm font-semibold flex items-center justify-center gap-2 hover:bg-accent/10 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-4 h-4" />
                                    {state.dict.tasks?.add_task || "Añadir tarea"}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <TaskEditModal
                dict={state.dict}
                currentUser={currentUser}
                locations={locations}
                users={users}
                adminOrManager={state.isAdminOrManager}
                saving={state.isSavingTask}
                deletingTask={state.isDeletingTask}
                selectedTask={state.selectedTask}
                setSelectedTask={state.setSelectedTask}
                editNotes={state.editNotes}
                setEditNotes={state.setEditNotes}
                editDescription={state.editDescription}
                setEditDescription={state.setEditDescription}
                editPrice={state.editPrice}
                setEditPrice={state.setEditPrice}
                editQuantity={state.editQuantity}
                setEditQuantity={state.setEditQuantity}
                editUnit={state.editUnit}
                setEditUnit={state.setEditUnit}
                editLocationId={state.editLocationId}
                setEditLocationId={state.setEditLocationId}
                editUserId={state.editUserId}
                editStatus={state.editStatus}
                setEditStatus={state.setEditStatus}
                editPriority={state.editPriority}
                setEditPriority={state.setEditPriority}
                editCreatedAt={state.editCreatedAt}
                setEditCreatedAt={state.setEditCreatedAt}
                editPlanningTime={state.editPlanningTime}
                setEditPlanningTime={state.setEditPlanningTime}
                handleSaveTaskDetails={state.handleSaveTaskDetails}
                handleDeleteTask={state.handleDeleteTask}
                handleDuplicateTask={state.handleDuplicateTask}
                getAssigneeName={state.getUserFullName}
            />

            <DeleteConfirmDialog
                open={state.isDeleteTaskDialogOpen}
                onOpenChange={state.setIsDeleteTaskDialogOpen}
                title={state.dict.tasks?.delete_confirm_dialog?.title || "Eliminar Tarea"}
                description={
                    state.dict.tasks?.delete_confirm_dialog?.description
                        ? state.dict.tasks.delete_confirm_dialog.description.replace(
                              "{title}",
                              state.taskToDelete?.title || ""
                          )
                        : `¿Estás seguro de que deseas eliminar la tarea "${state.taskToDelete?.title || ""}"? Esta acción no se puede deshacer.`
                }
                onConfirm={state.handleDeleteTaskConfirm}
                isDeleting={state.isDeletingTask}
                confirmText={state.dict.tasks?.delete_confirm_dialog?.confirm || "Eliminar"}
                cancelText={state.dict.tasks?.delete_confirm_dialog?.cancel || "Cancelar"}
            />
        </div>
    );
}
