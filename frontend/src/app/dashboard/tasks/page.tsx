"use client";

import React, { Suspense } from "react";
import { Plus, Columns3, ListTodo, Library, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { useTasksPage } from "@/hooks/useTasksPage";
import { TasksKanban } from "@/components/tasks/TasksKanban";
import { TasksList } from "@/components/tasks/TasksList";
import { TasksTemplates } from "@/components/tasks/TasksTemplates";
import { TaskFormModals } from "@/components/tasks/TaskFormModals";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PremiumTabs } from "@/components/ui/premium-tabs";

function TasksPageContent() {
    const state = useTasksPage();

    return (
        <div className="dashboard-page-content max-w-full overflow-x-hidden px-[3%] py-6 md:p-8">
            <PageHeader
                icon={ListTodo}
                title={state.dict.tasks?.page_title || "Tareas y Operaciones"}
                subtitle={state.dict.tasks?.page_subtitle || "Planifica el trabajo, sigue su avance y estandariza los servicios."}
                className="mb-6"
                actions={(
                    <>
                        {state.activeTab === "templates" && state.isAdminOrManager && (
                            <Button
                                onClick={() => state.handleOpenTemplateModal(null)}
                                className={PAGE_ACTION_BUTTON_PRIMARY}
                            >
                                <Plus className="w-4 h-4" />
                                {state.dict.tasks?.create_template || "Nuevo servicio"}
                            </Button>
                        )}

                    {state.activeTab !== "templates" && state.isAdminOrManager && (
                        <Button
                            onClick={() => state.setIsCreateOpen(true)}
                            className={PAGE_ACTION_BUTTON_PRIMARY}
                        >
                            <Plus className="w-4 h-4" />
                            {state.dict.tasks?.new_task || "Nueva Tarea"}
                        </Button>
                    )}
                    </>
                )}
            />

            <section className="billing-surface relative overflow-hidden rounded-[24px] p-4 sm:p-5">
                <div className="space-y-4">
                    <PremiumTabs
                        layout="fit"
                        tabs={[
                            { id: "kanban" as const, label: state.dict.tasks?.tab_kanban || "Tablero", icon: Columns3 },
                            ...(state.isAdminOrManager
                                ? [
                                    { id: "list" as const, label: state.dict.tasks?.tab_list || "Lista", icon: ListTodo },
                                    { id: "templates" as const, label: state.dict.tasks?.tab_templates || "Catálogo de servicios", icon: Library }
                                  ]
                                : [])
                        ]}
                        activeTab={state.activeTab}
                        onChange={state.setActiveTab}
                    />

                    {state.loadingData ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-[var(--text-main)]" />
                            <span className="text-xs text-[var(--text-muted)]">{state.dict.tasks?.syncing_flows || "Sincronizando flujos..."}</span>
                        </div>
                    ) : (
                        <>
                            {state.activeTab === "kanban" && (
                                <TasksKanban
                                    tasks={state.tasks}
                                    locations={state.locations}
                                    users={state.users}
                                    onTaskUpdate={state.loadTasks}
                                    currentUser={state.currentUser}
                                    onCreateTask={() => state.setIsCreateOpen(true)}
                                />
                            )}

                            {state.activeTab === "list" && state.isAdminOrManager && (
                                <TasksList
                                    dict={state.dict}
                                    tasks={state.tasks}
                                    locations={state.locations}
                                    users={state.users}
                                    isAdminOrManager={state.isAdminOrManager}
                                    currentUser={state.currentUser}
                                    loadingTasks={state.loadingTasks}
                                    selectedLocationId={state.selectedLocationId}
                                    setSelectedLocationId={state.setSelectedLocationId}
                                    selectedUserId={state.selectedUserId}
                                    setSelectedUserId={state.setSelectedUserId}
                                    selectedStatus={state.selectedStatus}
                                    setSelectedStatus={state.setSelectedStatus}
                                    handleOpenDetail={state.handleOpenDetail}
                                    handleToggleStatus={state.handleToggleStatus}
                                    getLocationName={state.getLocationName}
                                    getAssigneeName={state.getAssigneeName}
                                />
                            )}

                            {state.activeTab === "templates" && state.isAdminOrManager && (
                                <TasksTemplates
                                    templates={state.templates}
                                    handleOpenTemplateModal={state.handleOpenTemplateModal}
                                    onDeleteTemplate={state.handleDeleteTemplate}
                                    isDeletingTemplate={state.isDeletingTemplate}
                                    onDuplicateTemplate={state.handleDuplicateTemplate}
                                />
                            )}
                        </>
                    )}
                </div>
            </section>

            <TaskFormModals
                {...state}
                onAccept={state.handleAcceptTask}
                onReject={state.handleRejectTask}
            />

            <DeleteConfirmDialog
                open={state.isDeleteTaskDialogOpen}
                onOpenChange={state.setIsDeleteTaskDialogOpen}
                title={state.dict.tasks?.delete_confirm_dialog?.title || "Eliminar Tarea"}
                description={state.dict.tasks?.delete_confirm_dialog?.description
                    ? state.dict.tasks.delete_confirm_dialog.description.replace("{title}", state.taskToDelete?.title || "")
                    : `¿Estás seguro de que deseas eliminar la tarea "${state.taskToDelete?.title || ""}"? Esta acción no se puede deshacer.`}
                onConfirm={state.handleDeleteTaskConfirm}
                isDeleting={state.isDeletingTask}
                confirmText={state.dict.tasks?.delete_confirm_dialog?.confirm || "Eliminar"}
                cancelText={state.dict.tasks?.delete_confirm_dialog?.cancel || "Cancelar"}
            />
        </div>
    );
}

export default function TasksPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center gap-3 py-20">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--text-main)]" />
                <span className="text-xs text-[var(--text-muted)]">Sincronizando flujos...</span>
            </div>
        }>
            <TasksPageContent />
        </Suspense>
    );
}
