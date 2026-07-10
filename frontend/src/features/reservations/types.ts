export type ReservationViewMode = "active" | "history";

export interface ReservationFormState {
    locationId: string;
    checkIn: string;
    checkOut: string;
    guestCount: string;
    stayType: string;
    status: string;
    cleaningRequired: boolean;
    cleaningScheduledAt: string;
    notes: string;
    assignedUserId: string;
}

export interface ReservationFiltersState {
    location: string;
    provider: string;
    cleaning: string;
    date: string;
    year: string;
    month: string;
    search: string;
    showCancelled: boolean;
}

export interface ReservationProviderOption {
    id: number;
    name: string;
}
