"use client";

import { ReservationList } from "@/features/reservations/ReservationList";
import { ReservationsFilters } from "@/features/reservations/ReservationsFilters";
import type {
    ReservationFiltersState,
    ReservationProviderOption,
    ReservationViewMode,
} from "@/features/reservations/types";
import type { Dictionary, Locale } from "@/lib/dictionary-context";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";

type ReservationsListSectionProps = {
    dict: Dictionary;
    locale: Locale;
    loading: boolean;
    filters: ReservationFiltersState;
    onFiltersChange: (filters: ReservationFiltersState) => void;
    onResetFilters: () => void;
    locations: Location[];
    providers: ReservationProviderOption[];
    resultCount: number;
    viewMode: ReservationViewMode;
    onViewModeChange: (mode: ReservationViewMode) => void;
    reservations: Reservation[];
    locationMap: Map<number, Location>;
    companyId?: number;
    onEdit: (reservation: Reservation) => void;
    onCancel: (reservation: Reservation) => void;
};

export function ReservationsListSection({
    dict,
    locale,
    loading,
    filters,
    onFiltersChange,
    onResetFilters,
    locations,
    providers,
    resultCount,
    viewMode,
    onViewModeChange,
    reservations,
    locationMap,
    companyId,
    onEdit,
    onCancel,
}: ReservationsListSectionProps) {
    return (
        <div className="space-y-4">
            <ReservationsFilters
                dict={dict}
                filters={filters}
                onFiltersChange={onFiltersChange}
                locations={locations}
                providers={providers}
                resultCount={resultCount}
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
                onReset={onResetFilters}
            />
            <ReservationList
                loading={loading}
                reservations={reservations}
                locationMap={locationMap}
                dict={dict}
                locale={locale}
                companyId={companyId}
                onEdit={onEdit}
                onCancel={onCancel}
            />
        </div>
    );
}
