export interface AuditLog {
    id: number;
    company_id: number | null;
    actor_user_id: number | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    request_id: string | null;
    ip_address: string | null;
    details: {
        user_email?: string | null;
        user_name?: string | null;
        role?: string | null;
        company_name?: string | null;
        visitor_id?: string | null;
        path?: string | null;
        referrer?: string | null;
        title?: string | null;
        screen?: string | null;
        timezone?: string | null;
        language?: string | null;
        ip?: string | null;
        forwarded_for?: string | null;
        user_agent?: string | null;
        accept_language?: string | null;
        geo?: {
            country?: string | null;
            region?: string | null;
            city?: string | null;
            latitude?: string | number | null;
            longitude?: string | number | null;
        } | null;
        [key: string]: unknown;
    };
    created_at: string;
}
