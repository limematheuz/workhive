import { apiFetch, extractErrorMessage } from "@/lib/api";
import { AuditLog } from "@/types/audit-log";

export const AuditLogService = {
    getAuditLogs: async (limit = 300): Promise<AuditLog[]> => {
        const response = await apiFetch(`/api/v1/audit-logs/?limit=${limit}`, {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(await extractErrorMessage(response, "Error loading audit logs"));
        }
        return await response.json();
    },
};
