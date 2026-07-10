"use client";

import { ArrowUpRight, History, RotateCcw, Search } from "lucide-react";

import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";

import type {
    ReservationFiltersState,
    ReservationProviderOption,
    ReservationViewMode,
} from "./types";

interface ReservationsFiltersProps {
    dict: Dictionary;
    filters: ReservationFiltersState;
    onFiltersChange: (filters: ReservationFiltersState) => void;
    locations: Location[];
    providers: ReservationProviderOption[];
    resultCount: number;
    viewMode: ReservationViewMode;
    onViewModeChange: (mode: ReservationViewMode) => void;
    onReset: () => void;
}

export function ReservationsFilters({
    dict,
    filters,
    onFiltersChange,
    locations,
    providers,
    resultCount,
    viewMode,
    onViewModeChange,
    onReset,
}: ReservationsFiltersProps) {
    const updateFilter = <Key extends keyof ReservationFiltersState>(
        key: Key,
        value: ReservationFiltersState[Key]
    ) => {
        onFiltersChange({ ...filters, [key]: value });
    };
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, index) => currentYear + 1 - index);
    const months = Array.from({ length: 12 }, (_, index) => index + 1);

    return (
        <>
            <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] p-4 rounded-3xl shadow-sm space-y-3">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                        type="search"
                        value={filters.search}
                        onChange={(event) =>
                            updateFilter("search", event.target.value)
                        }
                        placeholder={
                            dict.reservations?.filters?.search_placeholder ||
                            "Buscar propiedad, dirección, proveedor o nota"
                        }
                        className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] outline-none focus:border-accent/50"
                    />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <select
                        value={filters.year}
                        onChange={(event) => updateFilter("year", event.target.value)}
                        aria-label="Filtrar por año"
                        className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer"
                    >
                        <option value="ALL">{dict.reservations?.filters?.all_years || "Todos los años"}</option>
                        {years.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                    <select
                        value={filters.month}
                        onChange={(event) => updateFilter("month", event.target.value)}
                        aria-label="Filtrar por mes"
                        className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer"
                    >
                        <option value="ALL">{dict.reservations?.filters?.all_months || "Todos los meses"}</option>
                        {months.map(month => (
                            <option key={month} value={month}>
                                {new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString(
                                    dict.reservations?.filters?.all_months === "All months" ? "en-US" : "es-ES",
                                    { month: "long", timeZone: "UTC" },
                                )}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.location}
                        onChange={(event) =>
                            updateFilter("location", event.target.value)
                        }
                        aria-label="Filtrar por propiedad"
                        className="bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer transition-all"
                    >
                        <option value="ALL">
                            {dict.reservations?.filters?.all_locations ||
                                "Todas las propiedades"}
                        </option>
                        {locations.map((location) => (
                            <option key={location.id} value={location.id}>
                                {location.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.provider}
                        onChange={(event) =>
                            updateFilter("provider", event.target.value)
                        }
                        aria-label="Filtrar por proveedor"
                        className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer"
                    >
                        <option value="ALL">
                            {dict.reservations?.filters?.all_providers ||
                                "Todos los proveedores"}
                        </option>
                        <option value="INTERNAL">
                            {dict.reservations?.filters?.internal_management ||
                                "Gestión interna"}
                        </option>
                        {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                                {provider.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.cleaning}
                        onChange={(event) =>
                            updateFilter("cleaning", event.target.value)
                        }
                        aria-label="Filtrar por estado de limpieza"
                        className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer"
                    >
                        <option value="ALL">
                            {dict.reservations?.filters?.any_cleaning ||
                                "Cualquier estado de limpieza"}
                        </option>
                        <option value="UNASSIGNED">
                            {dict.reservations?.filters?.unassigned_provider ||
                                "Sin proveedor asignado"}
                        </option>
                        <option value="requested">
                            {dict.reservations?.filters?.requested_cleaning ||
                                "Solicitud pendiente"}
                        </option>
                        <option value="pending">
                            {dict.reservations?.filters?.pending_cleaning ||
                                "Aceptada / pendiente"}
                        </option>
                        <option value="progress">
                            {dict.reservations?.filters?.progress_cleaning ||
                                "En progreso"}
                        </option>
                        <option value="completed">
                            {dict.reservations?.filters?.completed_cleaning ||
                                "Completada"}
                        </option>
                        <option value="rejected">
                            {dict.reservations?.filters?.rejected_cleaning ||
                                "Limpieza rechazada"}
                        </option>
                        <option value="NO_CLEANING">
                            {dict.reservations?.filters?.no_cleaning ||
                                "Sin limpieza"}
                        </option>
                    </select>
                    {viewMode === "active" && (
                        <select
                            value={filters.date}
                            onChange={(event) =>
                                updateFilter("date", event.target.value)
                            }
                            aria-label="Filtrar por fecha"
                            className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-main)] outline-none focus:border-accent/50 font-semibold uppercase tracking-wider cursor-pointer"
                        >
                            <option value="UPCOMING">
                                {dict.reservations?.filters?.status_upcoming ||
                                    "Próximas y activas"}
                            </option>
                            <option value="TODAY">
                                {dict.reservations?.filters?.status_today ||
                                    "Estancias de hoy"}
                            </option>
                            <option value="NEXT_7">
                                {dict.reservations?.filters?.status_next_7 ||
                                    "Entradas en 7 días"}
                            </option>
                            <option value="PAST">
                                {dict.reservations?.filters?.status_past ||
                                    "Histórico"}
                            </option>
                            <option value="ALL">
                                {dict.reservations?.filters?.status_all_dates ||
                                    "Todas las fechas"}
                            </option>
                        </select>
                    )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={filters.showCancelled}
                            onChange={(event) =>
                                updateFilter(
                                    "showCancelled",
                                    event.target.checked
                                )
                            }
                            className="w-4 h-4 rounded border-[var(--border-color)] bg-[var(--bg-card)] text-accent focus:ring-accent accent-accent cursor-pointer"
                        />
                        {dict.reservations?.filters?.show_cancelled ||
                            "Mostrar canceladas"}
                    </label>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[var(--text-muted)]">
                            {dict.reservations?.filters?.results_count
                                ? dict.reservations.filters.results_count.replace(
                                      "{count}",
                                      resultCount.toString()
                                  )
                                : `${resultCount} resultados`}
                        </span>
                        <button
                            type="button"
                            onClick={onReset}
                            className="btn-app-secondary inline-flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-sm transition-all hover:shadow-md"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {dict.reservations?.filters?.reset_filters ||
                                "Restablecer"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex bg-[var(--bg-primary)]/40 p-1 border border-[var(--border-soft)] rounded-2xl w-full gap-1 my-4">
                <button type="button"
                    onClick={() => onViewModeChange("active")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer border-none text-xs font-bold uppercase tracking-wider select-none ${
                        viewMode === "active"
                            ? "bg-accent text-white font-black shadow-md dark:bg-accent"
                            : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                >
                    <ArrowUpRight
                        className={`w-3.5 h-3.5 ${
                            viewMode === "active"
                                ? "text-white"
                                : "text-[var(--text-main)]"
                        }`}
                    />
                    {dict.reservations?.view_mode?.active || "Vigentes"}
                </button>
                <button type="button"
                    onClick={() => onViewModeChange("history")}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer border-none text-xs font-bold uppercase tracking-wider select-none ${
                        viewMode === "history"
                            ? "bg-accent text-white font-black shadow-md dark:bg-accent"
                            : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                >
                    <History
                        className={`w-3.5 h-3.5 ${
                            viewMode === "history"
                                ? "text-white"
                                : "text-[var(--text-main)]"
                        }`}
                    />
                    {dict.reservations?.view_mode?.history || "Historial"}
                </button>
            </div>
        </>
    );
}
