export type ServiceContractStatus = "draft" | "active" | "terminated"
export type ServiceContractRenewalMode = "manual" | "automatic"

export interface ServiceContractLine {
    id: number
    position: number
    description: string
    quantity: number
    unit_price: number
    subtotal: number
}

export interface ServiceContractLocation {
    id: number
    location_id: number
    location_name: string | null
    is_active: boolean
    covered_from: string
    covered_until: string | null
    covered_zones: ServiceContractLocationZone[]
}

export interface ServiceContractLocationZone {
    id: number
    zone_id: number
    zone_name: string | null
}

export interface ServiceContract {
    id: number
    contract_number: string
    title: string
    status: ServiceContractStatus
    company_id: number
    client_id: number | null
    source_quote_id: number
    source_quote_revision_id: number
    starts_at: string | null
    ends_at: string | null
    renewal_mode: ServiceContractRenewalMode
    renewal_notice_days: number
    response_time_hours: number | null
    resolution_time_hours: number | null
    service_window: string | null
    notes: string | null
    quote_snapshot: {
        title?: string
        total_amount?: number
        items?: Array<{
            description: string
            quantity: number
            unit_price: number
            subtotal: number
        }>
    }
    service_lines: ServiceContractLine[]
    covered_locations: ServiceContractLocation[]
    created_at: string
    updated_at: string
}

export interface ServiceContractTermsUpdate {
    title?: string
    starts_at?: string | null
    ends_at?: string | null
    renewal_mode?: ServiceContractRenewalMode
    renewal_notice_days?: number
    response_time_hours?: number | null
    resolution_time_hours?: number | null
    service_window?: string | null
    notes?: string | null
}
