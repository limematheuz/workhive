import { apiFetch } from "@/lib/api";
import { Role } from "@/types/role";

export type { Role };

export const RoleService = {
    getRoles: async (): Promise<Role[]> => {
        const response = await apiFetch("/api/v1/roles/", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("Error fetching roles");
        }
        return await response.json();
    },

    createRole: async (data: Omit<Role, "id" | "is_active">): Promise<Role> => {
        const response = await apiFetch("/api/v1/roles/", {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error creating role");
        }
        return await response.json();
    },

    updateRole: async (id: number, data: Partial<Omit<Role, "id">>): Promise<Role> => {
        const response = await apiFetch(`/api/v1/roles/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error updating role");
        }
        return await response.json();
    },
};
