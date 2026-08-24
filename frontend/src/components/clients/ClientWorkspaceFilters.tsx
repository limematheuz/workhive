"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientWorkspaceFilter } from "@/lib/client-workspace";

type ClientWorkspaceFiltersProps = {
    filters: ClientWorkspaceFilter;
    cities: string[];
    onChange: (filters: ClientWorkspaceFilter) => void;
};

const EMPTY_FILTERS: ClientWorkspaceFilter = {
    search: "",
    status: "all",
    clientType: "all",
    city: "",
    contact: "all",
};

export function ClientWorkspaceFilters({ filters, cities, onChange }: ClientWorkspaceFiltersProps) {
    const hasFilters = Object.entries(filters).some(([key, value]) => key === "search" ? Boolean(value) : value !== EMPTY_FILTERS[key as keyof ClientWorkspaceFilter]);
    const update = <Key extends keyof ClientWorkspaceFilter>(key: Key, value: ClientWorkspaceFilter[Key]) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <section className="billing-surface rounded-[22px] p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <label className="relative block min-w-0 flex-1 xl:max-w-[31rem]">
                    <span className="sr-only">Buscar clientes</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                    <Input
                        value={filters.search}
                        onChange={(event) => update("search", event.target.value)}
                        placeholder="Buscar por nombre, CIF, dirección, email…"
                        className="h-10 bg-[var(--bg-card-solid)] pl-10 text-sm"
                    />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 text-[11px] font-semibold text-[var(--text-muted)]">
                        <SlidersHorizontal className="h-4 w-4 text-accent" aria-hidden="true" /> Filtros
                    </span>
                    {hasFilters && (
                        <Button type="button" variant="outline" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
                            <RotateCcw aria-hidden="true" /> Limpiar filtros
                        </Button>
                    )}
                </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FilterSelect
                    label="Estado"
                    value={filters.status}
                    onChange={(value) => update("status", value as ClientWorkspaceFilter["status"])}
                    options={[
                        { value: "all", label: "Todos" },
                        { value: "active", label: "Activo" },
                        { value: "inactive", label: "Inactivo" },
                    ]}
                />
                <FilterSelect
                    label="Tipo de cliente"
                    value={filters.clientType}
                    onChange={(value) => update("clientType", value as ClientWorkspaceFilter["clientType"])}
                    options={[
                        { value: "all", label: "Todos" },
                        { value: "business", label: "Empresa" },
                        { value: "individual", label: "Particular" },
                        { value: "company", label: "Colaborador" },
                    ]}
                />
                <FilterSelect
                    label="Zona"
                    value={filters.city}
                    onChange={(value) => update("city", value)}
                    options={[{ value: "", label: "Todas" }, ...cities.map((city) => ({ value: city, label: city }))]}
                />
                <FilterSelect
                    label="Datos de contacto"
                    value={filters.contact}
                    onChange={(value) => update("contact", value as ClientWorkspaceFilter["contact"])}
                    options={[
                        { value: "all", label: "Todos" },
                        { value: "complete", label: "Con contacto" },
                        { value: "missing", label: "Pendiente" },
                    ]}
                />
            </div>
        </section>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <label className="grid gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span>
            <select
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm font-medium text-[var(--text-main)] outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
}
