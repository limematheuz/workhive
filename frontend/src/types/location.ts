export interface Location {
    id: number;
    name: string;
    address: string;
    city: string;
    postal_code?: string;
    client_id?: number | null;
    managing_company_id?: number | null;
    owner_company_id?: number | null;
    department_id?: number | null;
    team_id?: number | null;
    is_active: boolean;
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
    profile?: LocationProfile | null;
    access?: LocationAccessProfile | null;
}

export type LocationProfileAttributeValue = boolean | number | string;

export interface LocationProfile {
    location_id?: number;
    site_type: string;
    internal_code?: string | null;
    site_reference?: string | null;
    contact_name?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    service_notes?: string | null;
    attributes: Record<string, LocationProfileAttributeValue>;
}

export interface LocationAccessProfile {
    location_id?: number;
    permitted_days: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[];
    permitted_from?: string | null;
    permitted_until?: string | null;
    requires_outside_hours_authorization?: boolean;
    access_method?: string | null;
    keys_available?: boolean | null;
    keys_location?: string | null;
    key_custodian?: string | null;
    instructions?: string | null;
    has_access_code?: boolean;
}

export interface LocationCatalogAttribute {
    id: string;
    label: string;
    kind: "number" | "boolean";
}

export interface LocationCatalogSiteType {
    id: string;
    label: string;
    description: string;
    attributes: LocationCatalogAttribute[];
}

export interface LocationCatalog {
    site_types: LocationCatalogSiteType[];
}

export interface LocationSpaceTask {
    id?: number;
    title: string;
    category: string;
    frequency?: string | null;
    estimated_minutes?: number | null;
    sort_order?: number;
    is_active?: boolean;
}

export interface LocationSpace {
    id?: number;
    location_id?: number;
    parent_id?: number | null;
    name: string;
    space_type: string;
    attributes?: Record<string, LocationProfileAttributeValue>;
    sort_order?: number;
    is_active?: boolean;
    tasks?: LocationSpaceTask[];
}

export interface LocationBulkImportRowResult {
    row_number: number;
    name?: string | null;
    errors: string[];
}

export interface LocationBulkImportPreview {
    valid: boolean;
    rows: LocationBulkImportRowResult[];
}

export interface LocationBulkImportResult {
    created_count: number;
    rows: LocationBulkImportRowResult[];
}

export interface LocationZone {
    id: number;
    name: string;
    zone_type: string;
    sort_order: number;
    is_active: boolean;
    tasks?: LocationSpaceTask[];
}
