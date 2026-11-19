"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import styles from "./tasks-list-filters.module.css";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
    const controlClass = `${reservationFilterSelectClass} !min-w-0 !w-full`;
    const locationFilter = () => <SearchableSelect value={selectedLocationId} onValueChange={onSelectedLocationIdChange} aria-label="Filtrar por ubicación" className={controlClass} options={[
        { value: "", label: dict.tasks?.filter_all_locations || "Todas las ubicaciones" },
        ...locations.map(location => ({ value: String(location.id), label: location.name })),
    ]} />;
    const workerFilter = () => isAdminOrManager ? <SearchableSelect value={selectedUserId} onValueChange={onSelectedUserIdChange} aria-label="Filtrar por operario" className={controlClass} options={[
        { value: "", label: dict.tasks?.filter_all_operators || "Todos los trabajadores" },
        ...users.map(user => ({ value: String(user.id), label: user.full_name || user.email })),
    ]} /> : <p className="flex h-9 items-center text-sm text-muted-foreground">{dict.tasks?.filter_assigned_to_me || "Asignados a mí"}</p>;
    return <div className={`billing-block rounded-xl border border-[var(--border-soft)] p-3 ${styles.root}`}>
        <div className={styles.bar}>
            <div className={styles.search}>
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" aria-label="Buscar trabajo o ubicación" value={searchQuery} onChange={event => onSearchQueryChange(event.target.value)} placeholder={dict.tasks?.list_search || "Buscar trabajo o ubicación"} className={reservationFilterSearchClass} />
            </div>
            <div className={styles.desktopEntity}>{locationFilter()}</div>
            <div className={styles.desktopEntity}>{workerFilter()}</div>
            <div className={styles.status}><CompactFilterSelect value={selectedStatus} onValueChange={onSelectedStatusChange} aria-label="Filtrar por estado" className={controlClass} options={[
                { value: "", label: dict.tasks?.filter_all_statuses || "Todos los estados" },
                { value: "pending", label: dict.profile?.tables?.status_pending || "Pendiente" },
                { value: "accepted", label: dict.tasks?.filter_accepted || "Aceptado" },
                { value: "progress", label: dict.tasks?.filter_in_progress || "En curso" },
                { value: "review", label: dict.tasks?.filter_in_review || "En revisión" },
                { value: "completed", label: dict.profile?.tables?.status_completed || "Completado" },
            ]} /></div>
            <Sheet><SheetTrigger asChild><Button variant="outline" size="sm" className="h-9"><SlidersHorizontal aria-hidden="true" />Más filtros{(selectedPriority || dateScope !== "ALL") && <span className="size-2 rounded-full bg-accent" aria-label="Hay filtros adicionales activos" />}</Button></SheetTrigger>
                <SheetContent className="w-full max-w-sm overflow-y-auto p-4">
                    <SheetHeader className="pr-10"><SheetTitle>Filtrar trabajos</SheetTitle><SheetDescription>Los resultados se actualizan al cambiar cada filtro.</SheetDescription></SheetHeader>
                    <div className="mt-6 grid gap-5">
                        <div><p className="mb-2 text-sm font-medium">Ubicación</p>{locationFilter()}</div>
                        <div><p className="mb-2 text-sm font-medium">Trabajador</p>{workerFilter()}</div>
                        <div><p className="mb-2 text-sm font-medium">Prioridad</p><CompactFilterSelect value={selectedPriority} onValueChange={onSelectedPriorityChange} aria-label="Filtrar por prioridad" className={controlClass} options={[
                            { value: "", label: dict.tasks?.filter_all_priorities || "Todas las prioridades" },
                            { value: "high", label: dict.tasks?.priority_high || "Alta" },
                            { value: "medium", label: dict.tasks?.priority_medium || "Media" },
                            { value: "low", label: dict.tasks?.priority_low || "Baja" },
                        ]} /></div>
                        <div><p className="mb-2 text-sm font-medium">Fecha</p><CompactFilterSelect value={dateScope} onValueChange={onDateScopeChange} aria-label="Filtrar por fecha" className={controlClass} options={[
                            { value: "ALL", label: dict.tasks?.filter_all_dates || "Todas las fechas" },
                            { value: "UPCOMING", label: dict.tasks?.filter_upcoming || "Próximas" },
                            { value: "PAST", label: dict.tasks?.filter_past || "Fechas pasadas" },
                        ]} /></div>
                    </div>
                    <SheetClose asChild><Button className="mt-6">Ver {totalItems} {dict.tasks?.pagination_tasks || "tareas"}</Button></SheetClose>
                </SheetContent>
            </Sheet>
        </div>
    </div>;
}
