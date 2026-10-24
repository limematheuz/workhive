"use client";

import { Search } from "lucide-react";
import { CompactFilterSelect } from "@/components/ui/compact-filter-select";
import { Input } from "@/components/ui/input";
import {
    reservationFilterSearchClass,
    reservationFilterSelectClass,
} from "@/features/reservations/reservation-filter-styles";
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
        <div className="billing-block space-y-2.5 rounded-2xl border border-[var(--border-soft)] p-3 sm:p-3.5">
            <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    {dict.tasks?.filters || "Filters"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider tabular-nums text-[var(--text-muted)]">
                    {totalItems} {dict.tasks?.pagination_tasks || "tareas"}
                </span>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => onSearchQueryChange(event.target.value)}
                    placeholder={dict.tasks?.list_search || "Buscar tarea"}
                    className={reservationFilterSearchClass}
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <CompactFilterSelect
                    value={selectedLocationId}
                    onValueChange={onSelectedLocationIdChange}
                    aria-label="Filtrar por ubicación"
                    className={reservationFilterSelectClass}
                    options={[
                        { value: "", label: dict.tasks?.filter_all_locations || "All locations" },
                        ...locations.map((location) => ({ value: location.id.toString(), label: location.name })),
                    ]}
                />

                {isAdminOrManager ? (
                    <CompactFilterSelect
                        value={selectedUserId}
                        onValueChange={onSelectedUserIdChange}
                        aria-label="Filtrar por operario"
                        className={reservationFilterSelectClass}
                        options={[
                            { value: "", label: dict.tasks?.filter_all_operators || "All operators" },
                            ...users.map((user) => ({ value: user.id.toString(), label: user.full_name || user.email })),
                        ]}
                    />
                ) : (
                    <div className="inline-flex h-9 items-center rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {dict.tasks?.filter_assigned_to_me || "Assigned to me"}
                    </div>
                )}

                <CompactFilterSelect
                    value={selectedStatus}
                    onValueChange={onSelectedStatusChange}
                    aria-label="Filtrar por estado"
                    className={reservationFilterSelectClass}
                    options={[
                        { value: "", label: dict.tasks?.filter_all_statuses || "All statuses" },
                        { value: "pending", label: dict.profile?.tables?.status_pending || "Pending" },
                        { value: "accepted", label: dict.tasks?.filter_accepted || "Accepted" },
                        { value: "progress", label: dict.tasks?.filter_in_progress || "In progress" },
                        { value: "review", label: dict.tasks?.filter_in_review || "In review" },
                        { value: "completed", label: dict.profile?.tables?.status_completed || "Completed" },
                    ]}
                />

                <CompactFilterSelect
                    value={selectedPriority}
                    onValueChange={onSelectedPriorityChange}
                    aria-label="Filtrar por prioridad"
                    className={reservationFilterSelectClass}
                    options={[
                        { value: "", label: dict.tasks?.filter_all_priorities || "Todas las prioridades" },
                        { value: "high", label: dict.tasks?.priority_high || "High" },
                        { value: "medium", label: dict.tasks?.priority_medium || "Medium" },
                        { value: "low", label: dict.tasks?.priority_low || "Low" },
                    ]}
                />

                <CompactFilterSelect
                    value={dateScope}
                    onValueChange={onDateScopeChange}
                    aria-label="Filtrar por fecha"
                    className={reservationFilterSelectClass}
                    options={[
                        { value: "ALL", label: dict.tasks?.filter_all_dates || "Todas las fechas" },
                        { value: "UPCOMING", label: dict.tasks?.filter_upcoming || "Próximas" },
                        { value: "PAST", label: dict.tasks?.filter_past || "Fechas pasadas" },
                    ]}
                />
            </div>
        </div>
    );
}
