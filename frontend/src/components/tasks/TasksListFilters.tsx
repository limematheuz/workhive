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
    dateScope: string;
    onDateScopeChange: (value: string) => void;
}

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
    dateScope,
    onDateScopeChange,
}: TasksListFiltersProps) {
    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between gap-3 text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-wider">{dict.tasks?.filters || "Filters"}</span>
                </div>
                <span className="text-xs font-semibold">{totalItems} tareas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 w-full">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => onSearchQueryChange(event.target.value)}
                        placeholder="Buscar tarea"
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl pl-10 pr-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                    />
                </div>
                <select
                    value={selectedLocationId}
                    onChange={(e) => onSelectedLocationIdChange(e.target.value)}
                    aria-label="Filtrar por ubicación"
                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
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
                        className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                    >
                        <option value="">{dict.tasks?.filter_all_operators || "All operators"}</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id.toString()}>{u.full_name || u.email}</option>
                        ))}
                    </select>
                ) : (
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-xl px-3 py-2 text-xs text-[var(--text-muted)] flex items-center font-medium">
                        {dict.tasks?.filter_assigned_to_me || "Assigned to me"}
                    </div>
                )}

                <select
                    value={selectedStatus}
                    onChange={(e) => onSelectedStatusChange(e.target.value)}
                    aria-label="Filtrar por estado"
                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                >
                    <option value="">{dict.tasks?.filter_all_statuses || "All statuses"}</option>
                    <option value="pending">{dict.profile?.tables?.status_pending || "Pending"}</option>
                    <option value="progress">{dict.tasks?.filter_in_progress || "In progress"}</option>
                    <option value="review">{dict.tasks?.filter_in_review || "In review"}</option>
                    <option value="completed">{dict.profile?.tables?.status_completed || "Completed"}</option>
                </select>

                <select
                    value={dateScope}
                    onChange={(event) => onDateScopeChange(event.target.value)}
                    aria-label="Filtrar por fecha"
                    className="bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent transition-colors"
                >
                    <option value="ALL">Todas las fechas</option>
                    <option value="UPCOMING">Próximas</option>
                    <option value="PAST">Fechas pasadas</option>
                </select>
            </div>
        </div>
    );
}
