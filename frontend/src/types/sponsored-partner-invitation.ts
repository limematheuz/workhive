export interface SponsoredPartnerInvitation {
    id: number;
    email: string;
    company_name: string;
    status: "pending" | "accepted" | "declined" | "expired" | "revoked" | string;
    expires_at: string;
    created_at: string;
}

export interface SponsoredPartnerInvitationAcceptPayload {
    token: string;
    verification_code: string;
    company_name: string;
    tax_id: string;
    address: string;
    postal_code?: string;
    city?: string;
    province?: string;
    phone: string;
    full_name: string;
    password: string;
    accept_terms: boolean;
    accept_privacy: boolean;
    marketing_consent: boolean;
}
