"use client";

import { Filter, Search } from "lucide-react";
import { Location } from "@/services/location.service";
import { User } from "@/types/user";
import type { Dictionary } from "@/lib/dictionary-context";

interface TasksListFiltersProps {
    dict: Dictionary;
    totalItems: number;
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    selectedLocationId: string;
    onSelectedLocationIdChange: (value: string) => void;
    locations: Location[];
    isAdminOrManager: boolean;
    selectedUserId: string;
    onSelectedUserIdChange: (value: string) => void;
    users: User[];
    selectedStatus: string;
    onSelectedStatusChange: (value: string) => void;
    selectedPriority: string;
    onSelectedPriorityChange: (value: string) => void;
    dateScope: string;
    onDateScopeChange: (value: string) => void;
}

const controlClass =
    "h-9 w-full rounded-xl border border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-secondary)_80%,transparent)] px-3 text-xs text-[var(--text-main)] outline-none transition-colors focus:border-accent";

export function TasksListFilters({
    dict,
    totalItems,
    searchQuery,
    onSearchQueryChange,
    selectedLocationId,
    onSelectedLocationIdChange,
    locations,
    isAdminOrManager,
    selectedUserId,
    onSelectedUserIdChange,
    users,
    selectedStatus,
    onSelectedStatusChange,
    selectedPriority,
    onSelectedPriorityChange,
    dateScope,
    onDateScopeChange,
}: TasksListFiltersProps) {
    return (
        <div className="surface-glass-card mb-4 space-y-2.5 rounded-2xl p-2.5 sm:p-3">
            <div className="flex items-center justify-between gap-3 text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                        {dict.tasks?.filters || "Filters"}
                    </span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider tabular-nums">
                    {totalItems} {dict.tasks?.pagination_tasks || "tareas"}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <div className="relative sm:col-span-2 xl:col-span-1 2xl:col-span-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        placeholder={dict.tasks?.list_search || "Buscar tarea"}
                        className={`${controlClass} pl-9`}
                    />
                </div>
                <select
                    value={selectedLocationId}
                    onChange={(e) => onSelectedLocationIdChange(e.target.value)}
                    aria-label="Filtrar por ubicación"
                    className={controlClass}
                >
                    <option value="">{dict.tasks?.filter_all_locations || "All locations"}</option>
                    {locations.map(l => (
                        <option key={l.id} value={l.id.toString()}>{l.name}</option>
                    ))}
                </select>

                {isAdminOrManager ? (
                    <select
                        value={selectedUserId}
                        onChange={(e) => onSelectedUserIdChange(e.target.value)}
                        aria-label="Filtrar por operario"
                        className={controlClass}
                    >
                        <option value="">{dict.tasks?.filter_all_operators || "All operators"}</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id.toString()}>{u.full_name || u.email}</option>
                        ))}
                    </select>
                ) : (
                    <div className="flex h-9 items-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 text-xs font-medium text-[var(--text-muted)]">
                        {dict.tasks?.filter_assigned_to_me || "Assigned to me"}
                    </div>
                )}

                <select
                    value={selectedStatus}
                    onChange={(e) => onSelectedStatusChange(e.target.value)}
                    aria-label="Filtrar por estado"
                    className={controlClass}
                >
                    <option value="">{dict.tasks?.filter_all_statuses || "All statuses"}</option>
                    <option value="pending">{dict.profile?.tables?.status_pending || "Pending"}</option>
                    <option value="progress">{dict.tasks?.filter_in_progress || "In progress"}</option>
                    <option value="review">{dict.tasks?.filter_in_review || "In review"}</option>
                    <option value="completed">{dict.profile?.tables?.status_completed || "Completed"}</option>
                </select>

                <select
                    value={selectedPriority}
                    onChange={(e) => onSelectedPriorityChange(e.target.value)}
                    aria-label="Filtrar por prioridad"
                    className={controlClass}
                >
                    <option value="">{dict.tasks?.filter_all_priorities || "Todas las prioridades"}</option>
                    <option value="high">{dict.tasks?.priority_high || "High"}</option>
                    <option value="medium">{dict.tasks?.priority_medium || "Medium"}</option>
                    <option value="low">{dict.tasks?.priority_low || "Low"}</option>
                </select>

                <select
                    value={dateScope}
                    onChange={(event) => onDateScopeChange(event.target.value)}
                    aria-label="Filtrar por fecha"
                    className={controlClass}
                >
                    <option value="ALL">{dict.tasks?.filter_all_dates || "Todas las fechas"}</option>
                    <option value="UPCOMING">{dict.tasks?.filter_upcoming || "Próximas"}</option>
                    <option value="PAST">{dict.tasks?.filter_past || "Fechas pasadas"}</option>
                </select>
            </div>
        </div>
    );
}
