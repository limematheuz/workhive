"use client";

import { ArrowUpRight, History, RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CompactFilterSelect } from "@/components/ui/compact-filter-select";
import { Input } from "@/components/ui/input";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";

import {
    reservationFilterSearchClass,
    reservationFilterSelectClass,
} from "./reservation-filter-styles";
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
            <div className="billing-block space-y-2.5 rounded-2xl border border-[var(--border-soft)] p-3 sm:p-3.5">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <Input
                        type="search"
                        value={filters.search}
                        onChange={(event) =>
                            updateFilter("search", event.target.value)
                        }
                        placeholder={
                            dict.reservations?.filters?.search_placeholder ||
                            "Buscar propiedad, dirección, proveedor o nota"
                        }
                        className={reservationFilterSearchClass}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <CompactFilterSelect
                        value={filters.year}
                        onValueChange={(year) => updateFilter("year", year)}
                        aria-label="Filtrar por año"
                        className={reservationFilterSelectClass}
                        options={[
                            { value: "ALL", label: dict.reservations?.filters?.all_years || "Todos los años" },
                            ...years.map((year) => ({ value: String(year), label: String(year) })),
                        ]}
                    />
                    <CompactFilterSelect
                        value={filters.month}
                        onValueChange={(month) => updateFilter("month", month)}
                        aria-label="Filtrar por mes"
                        className={reservationFilterSelectClass}
                        options={[
                            { value: "ALL", label: dict.reservations?.filters?.all_months || "Todos los meses" },
                            ...months.map((month) => ({
                                value: String(month),
                                label: new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString(
                                    dict.reservations?.filters?.all_months === "All months" ? "en-US" : "es-ES",
                                    { month: "long", timeZone: "UTC" },
                                ),
                            })),
                        ]}
                    />
                    <CompactFilterSelect
                        value={filters.location}
                        onValueChange={(location) => updateFilter("location", location)}
                        aria-label="Filtrar por propiedad"
                        className={reservationFilterSelectClass}
                        options={[
                            { value: "ALL", label: dict.reservations?.filters?.all_locations || "Todas las propiedades" },
                            ...locations.map((location) => ({ value: String(location.id), label: location.name })),
                        ]}
                    />
                    <CompactFilterSelect
                        value={filters.provider}
                        onValueChange={(provider) => updateFilter("provider", provider)}
                        aria-label="Filtrar por proveedor"
                        className={reservationFilterSelectClass}
                        options={[
                            { value: "ALL", label: dict.reservations?.filters?.all_providers || "Todos los proveedores" },
                            { value: "INTERNAL", label: dict.reservations?.filters?.internal_management || "Gestión interna" },
                            ...providers.map((provider) => ({ value: String(provider.id), label: provider.name })),
                        ]}
                    />
                    <CompactFilterSelect
                        value={filters.cleaning}
                        onValueChange={(cleaning) => updateFilter("cleaning", cleaning)}
                        aria-label="Filtrar por estado de limpieza"
                        className={reservationFilterSelectClass}
                        options={[
                            { value: "ALL", label: dict.reservations?.filters?.any_cleaning || "Cualquier estado de limpieza" },
                            { value: "UNASSIGNED", label: dict.reservations?.filters?.unassigned_provider || "Sin proveedor asignado" },
                            { value: "requested", label: dict.reservations?.filters?.requested_cleaning || "Solicitud pendiente" },
                            { value: "pending", label: dict.reservations?.filters?.pending_cleaning || "Aceptada / pendiente" },
                            { value: "progress", label: dict.reservations?.filters?.progress_cleaning || "En progreso" },
                            { value: "completed", label: dict.reservations?.filters?.completed_cleaning || "Completada" },
                            { value: "rejected", label: dict.reservations?.filters?.rejected_cleaning || "Limpieza rechazada" },
                            { value: "NO_CLEANING", label: dict.reservations?.filters?.no_cleaning || "Sin limpieza" },
                        ]}
                    />
                    {viewMode === "active" ? (
                        <CompactFilterSelect
                            value={filters.date}
                            onValueChange={(date) => updateFilter("date", date)}
                            aria-label="Filtrar por fecha"
                            className={reservationFilterSelectClass}
                            options={[
                                { value: "UPCOMING", label: dict.reservations?.filters?.status_upcoming || "Próximas y activas" },
                                { value: "TODAY", label: dict.reservations?.filters?.status_today || "Estancias de hoy" },
                                { value: "NEXT_7", label: dict.reservations?.filters?.status_next_7 || "Entradas en 7 días" },
                                { value: "PAST", label: dict.reservations?.filters?.status_past || "Histórico" },
                                { value: "ALL", label: dict.reservations?.filters?.status_all_dates || "Todas las fechas" },
                            ]}
                        />
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
                    <label className="flex cursor-pointer select-none items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        <Checkbox
                            checked={filters.showCancelled}
                            onCheckedChange={(checked) =>
                                updateFilter("showCancelled", checked === true)
                            }
                            aria-label={
                                dict.reservations?.filters?.show_cancelled ||
                                "Mostrar canceladas"
                            }
                        />
                        {dict.reservations?.filters?.show_cancelled ||
                            "Mostrar canceladas"}
                    </label>
                    <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                            {dict.reservations?.filters?.results_count
                                ? dict.reservations.filters.results_count.replace(
                                      "{count}",
                                      resultCount.toString()
                                  )
                                : `${resultCount} resultados`}
                        </span>
                        <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            onClick={onReset}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {dict.reservations?.filters?.reset_filters ||
                                "Restablecer"}
                        </Button>
                    </div>
                </div>
            </div>

            <PremiumTabs<ReservationViewMode>
                layout="fit"
                tabs={[
                    {
                        id: "active",
                        label: dict.reservations?.view_mode?.active || "Vigentes",
                        icon: ArrowUpRight,
                    },
                    {
                        id: "history",
                        label: dict.reservations?.view_mode?.history || "Historial",
                        icon: History,
                    },
                ]}
                activeTab={viewMode}
                onChange={onViewModeChange}
            />
        </>
    );
}
