"use client";

import { Search } from "lucide-react";
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
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 md:grid-cols-[minmax(220px,1.6fr)_repeat(3,minmax(150px,1fr))]">
            <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Buscar propiedad, dirección o solicitud"
                    className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] pl-10 pr-3 text-sm font-semibold text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-accent"
                />
            </label>
            <select
                value={locationFilter}
                onChange={(event) => onLocationFilterChange(event.target.value)}
                aria-label="Filtrar por propiedad"
                className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent"
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
                className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent"
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
                className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none focus:border-accent"
            >
                <option value="ALL">Todas las fechas</option>
                <option value="TURNOVER">Cambio el mismo día</option>
                <option value="NEXT_7">Próximos 7 días</option>
                <option value="NO_NEXT">Sin próxima entrada</option>
            </select>
        </div>
    );
}
