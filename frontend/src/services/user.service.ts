import { apiFetch, assertApiResponseOk } from "@/lib/api";
import { buildWorkerInvitationPayload } from "@/lib/user-invitation";
import { UserStatsResponse, WorkSession, TaskItem, User } from "@/types/user";

export type UserInvitation = {
    id: number;
    email: string;
    full_name: string | null;
    role_id: number;
    role_name: string;
    status: "pending" | "expired" | "canceled";
    expires_at: string;
    created_at: string;
    rejoin_existing_identity: boolean;
};

export const UserService = {
    /**
     * Gets the list of company users.
     */
    getUsers: async (skip: number = 0, limit: number = 100): Promise<User[]> => {
        const response = await apiFetch(`/api/v1/users/?skip=${skip}&limit=${limit}`, {
            method: "GET",
            cache: "no-store"
        });
        if (!response.ok) {
            throw new Error("Error fetching users");
        }
        return await response.json();
    },

    /**
     * Gets aggregate statistics for a specific user.
     */
    getUserStats: async (userId: number): Promise<UserStatsResponse> => {
        const response = await apiFetch(`/api/v1/users/${userId}/stats`, {
            method: "GET",
            cache: "no-store"
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error fetching user stats");
        }
        return await response.json();
    },

    /**
     * Gets the current user's work session history.
     */
    getUserWorkSessions: async (limit: number = 100): Promise<WorkSession[]> => {
        const response = await apiFetch(`/api/v1/work-sessions/?limit=${limit}`, {
            method: "GET",
            cache: "no-store"
        });
        if (!response.ok) {
            throw new Error("Error fetching work sessions");
        }
        return await response.json();
    },

    /**
     * Gets the history of tasks assigned to or completed by the user.
     */
    getUserTasks: async (userId: number, limit: number = 100): Promise<TaskItem[]> => {
        const response = await apiFetch(`/api/v1/task-items/?user_id=${userId}&limit=${limit}`, {
            method: "GET",
            cache: "no-store"
        });
        await assertApiResponseOk(response, "Error fetching user tasks");
        return await response.json();
    },

    /** Sends a verified invitation to a future worker. */
    inviteUser: async (data: {
        email: string;
        full_name?: string;
        role_id: number;
    }): Promise<void> => {
        const response = await apiFetch(`/api/v1/user-invitations/`, {
            method: "POST",
            body: JSON.stringify(buildWorkerInvitationPayload(data)),
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error sending invitation");
        }
    },

    getInvitations: async (): Promise<UserInvitation[]> => {
        const response = await apiFetch("/api/v1/user-invitations/", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "No se pudieron cargar las invitaciones");
        return response.json() as Promise<UserInvitation[]>;
    },

    cancelInvitation: async (invitationId: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/user-invitations/${invitationId}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "No se pudo cancelar la invitación");
    },

    /**
     * Updates a worker's role or status, or the current user's profile.
     */
    updateUser: async (id: number, data: {
        full_name?: string;
        email?: string;
        password?: string;
        old_password?: string;
        photo_url?: string | null;
        role_id?: number;
        is_active?: boolean;
    }): Promise<User> => {
        const response = await apiFetch(`/api/v1/users/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error updating user");
        }
        return await response.json();
    },

    uploadUserPhoto: async (id: number, file: File): Promise<User> => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await apiFetch(`/api/v1/users/${id}/photo`, {
            method: "POST",
            body: formData
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || "Error uploading user photo");
        }
        return await response.json();
    },

    deleteUser: async (id: number): Promise<void> => {
        const response = await apiFetch(`/api/v1/users/${id}`, {
            method: "DELETE",
        });
        await assertApiResponseOk(response, "No se pudo eliminar el usuario");
    }
};
