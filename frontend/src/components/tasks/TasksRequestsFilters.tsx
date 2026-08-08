"use client";

import { Search } from "lucide-react";

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
                <select
                    value={locationFilter}
                    onChange={(event) => onLocationFilterChange(event.target.value)}
                    aria-label="Filtrar por propiedad"
                    className={reservationFilterSelectClass}
                >
                    <option value="ALL">Todas las propiedades</option>
                    {requestLocations.map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                    ))}
                </select>
                <select
                    value={issuerFilter}
                    onChange={(event) => onIssuerFilterChange(event.target.value)}
                    aria-label="Filtrar por emisora"
                    className={reservationFilterSelectClass}
                >
                    <option value="ALL">Todas las emisoras</option>
                    {issuers.map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                    ))}
                </select>
                <select
                    value={dateFilter}
                    onChange={(event) => onDateFilterChange(event.target.value)}
                    aria-label="Filtrar por fecha"
                    className={reservationFilterSelectClass}
                >
                    <option value="ALL">Todas las fechas</option>
                    <option value="TURNOVER">Cambio el mismo día</option>
                    <option value="NEXT_7">Próximos 7 días</option>
                    <option value="NO_NEXT">Sin próxima entrada</option>
                </select>
            </div>
        </div>
    );
}
