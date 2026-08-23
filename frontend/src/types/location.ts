export interface Location {
    id: number;
    name: string;
    address: string;
    city: string;
    postal_code?: string;
    client_id?: number | null;
    managing_company_id?: number | null;
    owner_company_id?: number | null;
    is_active: boolean;
    photo_url?: string;
    latitude?: number;
    longitude?: number;
    map_url?: string;
    location_type?: string;
    default_service_provider_id?: number | null;
    can_manage_reservations?: boolean;
    can_manage_tasks?: boolean;
    num_bathrooms?: number;
    has_garage?: boolean;
    has_kitchen?: boolean;
    has_terrace?: boolean;
    rooms?: {
        id?: string | number;
        name: string;
        double_beds: number;
        single_beds: number;
        bunk_beds: number;
    }[];
    checkout_checklist?: string[];
    max_capacity?: number;
    shared_companies?: number[];
}

export interface LocationZone {
    id: number;
    name: string;
    zone_type: string;
    sort_order: number;
    is_active: boolean;
}
