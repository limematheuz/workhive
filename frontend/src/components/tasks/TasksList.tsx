"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cleanChecklistDescription } from "@/lib/format";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import {
    filterTasksForGeneralList,
    paginateTaskListPage,
    partitionTasksForGeneralList,
    TASK_LIST_PAGE_SIZE,
    type TaskListDateScope,
} from "./tasksListUtils";
import { TasksListFilters } from "./TasksListFilters";
import { TaskListCard } from "./TaskListCard";
import { TasksListPagination } from "./TasksListPagination";

interface TasksListProps {
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

export function TasksList({
    dict,
    tasks,
    locations,
    users,
    isAdminOrManager,
    currentUser,
    loadingTasks,
    selectedLocationId,
    setSelectedLocationId,
    selectedUserId,
    setSelectedUserId,
    selectedStatus,
    setSelectedStatus,
    handleOpenDetail,
    handleToggleStatus,
    getLocationName,
    getAssigneeName,
}: TasksListProps) {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [dateScope, setDateScope] = React.useState<TaskListDateScope>("ALL");
    const [selectedPriority, setSelectedPriority] = React.useState("");
    const pageContextKey = `${selectedLocationId}|${selectedUserId}|${selectedStatus}|${selectedPriority}|${searchQuery}|${dateScope}`;
    const [pageState, setPageState] = React.useState({ contextKey: pageContextKey, page: 1 });
    const currentPage = pageState.contextKey === pageContextKey ? pageState.page : 1;
    const setCurrentPage = React.useCallback((nextPage: React.SetStateAction<number>) => {
        setPageState((prev) => {
            const activePage = prev.contextKey === pageContextKey ? prev.page : 1;
            const resolvedPage = typeof nextPage === "function"
                ? nextPage(activePage)
                : nextPage;
            return { contextKey: pageContextKey, page: resolvedPage };
        });
    }, [pageContextKey]);

    const visibleTasks = React.useMemo(
        () => filterTasksForGeneralList(
            tasks.map(task => ({
                ...task,
                description: cleanChecklistDescription(task.description || ""),
            })),
            {
                query: searchQuery,
                dateScope,
                priority: selectedPriority,
                getLocationName,
                getAssigneeName,
            },
        ),
        [dateScope, getAssigneeName, getLocationName, searchQuery, selectedPriority, tasks],
    );

    const { active, completed } = React.useMemo(
        () => partitionTasksForGeneralList(visibleTasks),
        [visibleTasks],
    );

    const showOnlyCompleted = selectedStatus === "completed";
    const showCompletedSection = !showOnlyCompleted && selectedStatus === "" && completed.length > 0;
    const primaryTasks = showOnlyCompleted ? completed : active;
    const { pageItems: paginatedPrimary, totalPages, safePage: safeCurrentPage } = paginateTaskListPage(
        primaryTasks,
        currentPage,
        TASK_LIST_PAGE_SIZE,
    );
    const totalItems = visibleTasks.length;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || Math.abs(i - safeCurrentPage) <= 1) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== "...") {
                pages.push("...");
            }
        }
        return pages;
    };
    const pageNumbers = getPageNumbers();

    function renderCards(items: TaskItem[], dimmed = false) {
        return (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {items.map(task => (
                    <TaskListCard
                        key={task.id}
                        dict={dict}
                        task={task}
                        locations={locations}
                        currentUser={currentUser}
                        isAdminOrManager={isAdminOrManager}
                        handleOpenDetail={handleOpenDetail}
                        handleToggleStatus={handleToggleStatus}
                        getAssigneeName={getAssigneeName}
                        getLocationName={getLocationName}
                        dimmed={dimmed}
                    />
                ))}
            </div>
        );
    }

    return (
        <div>
            <TasksListFilters
                dict={dict}
                totalItems={totalItems}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                selectedLocationId={selectedLocationId}
                onSelectedLocationIdChange={setSelectedLocationId}
                locations={locations}
                isAdminOrManager={isAdminOrManager}
                selectedUserId={selectedUserId}
                onSelectedUserIdChange={setSelectedUserId}
                users={users}
                selectedStatus={selectedStatus}
                onSelectedStatusChange={setSelectedStatus}
                selectedPriority={selectedPriority}
                onSelectedPriorityChange={setSelectedPriority}
                dateScope={dateScope}
                onDateScopeChange={(value) => setDateScope(value as TaskListDateScope)}
            />

            {loadingTasks ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <span className="text-xs text-[var(--text-muted)]">{dict.dashboard?.tasks_loading || "Loading tasks..."}</span>
                </div>
            ) : totalItems > 0 ? (
                <div className="space-y-5">
                    {!showOnlyCompleted && (
                        <section className="space-y-2.5">
                            {selectedStatus === "" && (
                                <h2 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                    {dict.tasks?.section_active || "Activas"}
                                    <span className="ml-2 tabular-nums text-accent">{active.length}</span>
                                </h2>
                            )}
                            {paginatedPrimary.length > 0 ? (
                                renderCards(paginatedPrimary)
                            ) : (
                                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-card)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                                    {dict.tasks?.no_active_tasks || "No hay tareas activas con estos filtros."}
                                </div>
                            )}
                        </section>
                    )}

                    {showOnlyCompleted && (
                        <section className="space-y-2.5">
                            <h2 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                {dict.tasks?.section_completed || "Completadas"}
                                <span className="ml-2 tabular-nums text-accent">{completed.length}</span>
                            </h2>
                            {renderCards(paginatedPrimary, true)}
                        </section>
                    )}

                    {showCompletedSection && (
                        <section className="space-y-2.5 border-t border-[var(--border-soft)] pt-4">
                            <h2 className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                                {dict.tasks?.section_completed || "Completadas"}
                                <span className="ml-2 tabular-nums">{completed.length}</span>
                            </h2>
                            {renderCards(completed.slice(0, TASK_LIST_PAGE_SIZE), true)}
                            {completed.length > TASK_LIST_PAGE_SIZE && (
                                <p className="text-[11px] font-medium text-[var(--text-muted)]">
                                    {(dict.tasks?.completed_preview || "Mostrando {count} de {total}. Filtra por Completadas para ver el resto.")
                                        .replace("{count}", String(TASK_LIST_PAGE_SIZE))
                                        .replace("{total}", String(completed.length))}
                                </p>
                            )}
                        </section>
                    )}

                    <TasksListPagination
                        dict={dict}
                        itemsPerPage={TASK_LIST_PAGE_SIZE}
                        safeCurrentPage={safeCurrentPage}
                        currentPage={currentPage}
                        totalItems={primaryTasks.length}
                        totalPages={totalPages}
                        pageNumbers={pageNumbers}
                        setCurrentPage={setCurrentPage}
                    />
                </div>
            ) : (
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] py-20 text-center">
                    <p className="text-sm font-medium text-[var(--text-muted)]">
                        {dict.tasks?.no_tasks_found || "No tasks found in the general list."}
                    </p>
                </div>
            )}
        </div>
    );
}
