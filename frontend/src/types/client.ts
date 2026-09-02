export interface Client {
    id: number;
    name: string;
    client_type: "individual" | "business" | "company";
    relationship_status?: "lead" | "client";
    email?: string | null;
    phone?: string | null;
    address: string;
    city: string;
    province?: string | null;
    postal_code: string;
    country: string;
    legal_number?: string | null;
    is_active: boolean;
    company_id: number;
}

export type ClientContactRole =
    | "commercial"
    | "billing"
    | "operations"
    | "quality"
    | "emergency"
    | "general";

export interface ClientContact {
    id: number;
    client_id: number;
    full_name: string;
    email?: string | null;
    phone?: string | null;
    job_title?: string | null;
    roles: ClientContactRole[];
    is_primary: boolean;
    is_active: boolean;
}

export type ClientContactPayload = Omit<ClientContact, "id" | "client_id">;
