import type { AuditLog } from "../../types/audit-log.ts";

/** Metrics describe the loaded audit sample. Anonymous browser IDs never count as authenticated users. */
export function trafficMetrics(events: AuditLog[], now = Date.now()) {
    const valid = events.filter(event => Number.isFinite(Date.parse(event.created_at)) && Date.parse(event.created_at) <= now);
    const users = new Set(valid.filter(event => event.action === "auth.login").flatMap(event => {
        if (event.actor_user_id != null) return [`user:${event.actor_user_id}`];
        const email = event.details.user_email?.trim().toLowerCase();
        return email ? [`email:${email}`] : [];
    }));
    return {
        total: valid.length,
        last24h: valid.filter(event => now - Date.parse(event.created_at) <= 86_400_000).length,
        last7d: valid.filter(event => now - Date.parse(event.created_at) <= 7 * 86_400_000).length,
        uniqueUsers: users.size,
    };
}
