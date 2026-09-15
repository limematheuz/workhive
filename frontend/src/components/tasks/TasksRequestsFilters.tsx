"use client";

import { Search } from "lucide-react";

import { CompactFilterSelect } from "@/components/ui/compact-filter-select";
import { Input } from "@/components/ui/input";
import {
    reservationFilterSearchClass,
    reservationFilterSelectClass,
} from "@/features/reservations/reservation-filter-styles";
import { Location } from "@/services/location.service";

interface TasksRequestsFiltersProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    locationFilter: string;
    onLocationFilterChange: (value: string) => void;
    issuerFilter: string;
    onIssuerFilterChange: (value: string) => void;
    dateFilter: string;
    onDateFilterChange: (value: string) => void;
    requestLocations: Location[];
    issuers: [number, string][];
}

export function TasksRequestsFilters({
    searchQuery,
    onSearchChange,
    locationFilter,
    onLocationFilterChange,
    issuerFilter,
    onIssuerFilterChange,
    dateFilter,
    onDateFilterChange,
    requestLocations,
    issuers,
}: TasksRequestsFiltersProps) {
    return (
        <div className="billing-block space-y-2.5 rounded-2xl border border-[var(--border-soft)] p-3 sm:p-3.5">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Buscar propiedad, dirección o solicitud"
                    className={reservationFilterSearchClass}
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <CompactFilterSelect
                    value={locationFilter}
                    onValueChange={onLocationFilterChange}
                    aria-label="Filtrar por propiedad"
                    className={reservationFilterSelectClass}
                    options={[
                        { value: "ALL", label: "Todas las propiedades" },
                        ...requestLocations.map((location) => ({ value: String(location.id), label: location.name })),
                    ]}
                />
                <CompactFilterSelect
                    value={issuerFilter}
                    onValueChange={onIssuerFilterChange}
                    aria-label="Filtrar por emisora"
                    className={reservationFilterSelectClass}
                    options={[
                        { value: "ALL", label: "Todas las emisoras" },
                        ...issuers.map(([id, name]) => ({ value: String(id), label: name })),
                    ]}
                />
                <CompactFilterSelect
                    value={dateFilter}
                    onValueChange={onDateFilterChange}
                    aria-label="Filtrar por fecha"
                    className={reservationFilterSelectClass}
                    options={[
                        { value: "ALL", label: "Todas las fechas" },
                        { value: "TURNOVER", label: "Cambio el mismo día" },
                        { value: "NEXT_7", label: "Próximos 7 días" },
                        { value: "NO_NEXT", label: "Sin próxima entrada" },
                    ]}
                />
            </div>
        </div>
    );
}
