import { Company } from "./company";

export interface CompanyCollaboration {
    id: number;
    initiator_company_id: number;
    partner_company_id: number;
    status: "pending" | "accepted" | "rejected";
    role_type: "service_provider" | "property_manager" | string;
    token?: string | null;
    created_at: string;
    updated_at: string;
    initiator: Company;
    partner: Company;
}

export interface CompanyCollaborationInvitation {
    id: number;
    email: string;
    role_type: "service_provider" | "property_manager";
    status: "pending" | "accepted" | "declined" | "expired" | "revoked" | string;
    expires_at: string;
    created_at: string;
}
