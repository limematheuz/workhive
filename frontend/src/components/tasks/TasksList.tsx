"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cleanChecklistDescription } from "@/lib/format";
import { TaskItem } from "@/services/task.service";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";
import { getStatusWeight } from "./tasksListUtils";
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
    const [dateScope, setDateScope] = React.useState("ALL");
    const itemsPerPage = 12;
    const pageContextKey = `${selectedLocationId}|${selectedUserId}|${selectedStatus}|${searchQuery}|${dateScope}`;
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

    const visibleTasks = React.useMemo(() => {
        const query = searchQuery.trim().toLocaleLowerCase("es");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return tasks.filter((task) => {
            const planningDate = new Date(task.due_at || task.scheduled_start_at || task.created_at);
            const matchesDate =
                dateScope === "ALL"
                || (dateScope === "UPCOMING" && planningDate >= today)
                || (dateScope === "PAST" && planningDate < today);
            if (!matchesDate) return false;
            if (!query) return true;

            return [
                task.title,
                cleanChecklistDescription(task.description || ""),
                getLocationName(task.location_id),
                getAssigneeName(task.user_id),
            ]
                .filter(Boolean)
                .some((value) => value.toLocaleLowerCase("es").includes(query));
        });
    }, [dateScope, getAssigneeName, getLocationName, searchQuery, tasks]);

    const sortedTasks = [...visibleTasks].sort((a, b) => {
        const weightA = getStatusWeight(a);
        const weightB = getStatusWeight(b);
        if (weightA !== weightB) {
            return weightA - weightB;
        }
        return b.id - a.id; // Newer first
    });

    const totalItems = sortedTasks.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
    const paginatedTasks = sortedTasks.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

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
                dateScope={dateScope}
                onDateScopeChange={setDateScope}
            />

            {loadingTasks ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    <span className="text-xs text-[var(--text-muted)]">{dict.dashboard?.tasks_loading || "Loading tasks..."}</span>
                </div>
            ) : totalItems > 0 ? (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {paginatedTasks.map(task => (
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
                            />
                        ))}
                    </div>

                    <TasksListPagination
                        dict={dict}
                        itemsPerPage={itemsPerPage}
                        safeCurrentPage={safeCurrentPage}
                        currentPage={currentPage}
                        totalItems={totalItems}
                        totalPages={totalPages}
                        pageNumbers={pageNumbers}
                        setCurrentPage={setCurrentPage}
                    />
                </div>
            ) : (
                <div className="text-center py-20 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)]">
                    <p className="text-sm text-[var(--text-muted)] font-medium">
                        {dict.tasks?.no_tasks_found || "No tasks found in the general list."}
                    </p>
                </div>
            )}
        </div>
    );
}
