export type ApiAccessScope = "work_orders.read" | "reservations.write";

export type ApiAccessKey = {
    id: number;
    name: string;
    key_prefix: string;
    scopes: ApiAccessScope[];
    status: "active" | "revoked";
    expires_at: string | null;
    last_used_at: string | null;
    revoked_at: string | null;
    created_at: string;
};

export type CreatedApiAccessKey = ApiAccessKey & {
    api_key: string;
};
