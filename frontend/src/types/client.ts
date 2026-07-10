export interface Client {
    id: number;
    name: string;
    client_type: "individual" | "business" | "company";
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
