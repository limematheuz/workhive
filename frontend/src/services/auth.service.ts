import { apiFetch, assertApiResponseOk, extractErrorMessage } from "@/lib/api";
import { clearSessionCache, setCsrfToken } from "@/lib/auth";
import { getVisitorId } from "@/lib/visitor-id";
import { buildInvitationAcceptancePayload } from "@/lib/user-invitation";
import { User } from "@/types/user";

export const authService = {
    getMe: async (): Promise<User> => {
        const response = await apiFetch("/api/v1/users/me", {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Failed to fetch user profile");
        return await response.json();
    },

    login: async (email: string, password: string): Promise<void> => {
        const formData = new URLSearchParams({
            username: email,
            password: password,
        });

        const response = await apiFetch("/api/v1/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-WorkHive-Visitor-ID": getVisitorId(),
            },
            body: formData,
        });

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("Invalid Credentials. Check your email and password.");
            }
            if (response.status >= 500) {
                throw new Error("The authentication service is temporarily unavailable. Please try again.");
            }
            throw new Error(await extractErrorMessage(response, "Could not sign in."));
        }
        const data = await response.json() as { csrf_token?: string };
        if (data.csrf_token) {
            setCsrfToken(data.csrf_token);
        }
    },

    logout: async (): Promise<void> => {
        const response = await apiFetch("/api/v1/auth/logout", {
            method: "POST",
        });
        if (!response.ok && response.status !== 401) {
            throw new Error("No se pudo cerrar la sesión");
        }
    },

    register: async (
        email: string,
        password: string,
        fullName: string,
        policyVersion: string,
        marketingConsent: boolean = false,
    ): Promise<void> => {
        const response = await apiFetch("/api/v1/auth/register", {
            method: "POST",
            body: JSON.stringify({
                email,
                password,
                full_name: fullName,
                accept_terms: true,
                accept_privacy: true,
                marketing_consent: marketingConsent,
                policy_version: policyVersion,
            }),
        });

        if (!response.ok) {
            throw new Error("Registration failed. Please verify your information.");
        }
    },

    requestPasswordReset: async (email: string): Promise<void> => {
        const response = await apiFetch("/api/v1/auth/forgot-password", {
            method: "POST",
            body: JSON.stringify({ email: email }),
        });

        await assertApiResponseOk(response, "No se pudo procesar la solicitud de recuperación");
    },

    resetPassword: async (token: string, newPassword: string): Promise<void> => {
        const response = await apiFetch("/api/v1/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({ token: token, new_password: newPassword }),
        });

        if (!response.ok) {
            const errorMsg = await extractErrorMessage(response, "No se pudo restablecer la contraseña");
            throw new Error(errorMsg);
        }
    },

    requestEmailChange: async (
        newEmail: string,
        currentPassword: string,
    ): Promise<void> => {
        const response = await apiFetch("/api/v1/auth/request-email-change", {
            method: "POST",
            body: JSON.stringify({
                new_email: newEmail,
                current_password: currentPassword,
            }),
        });
        if (!response.ok) {
            const message = await extractErrorMessage(
                response,
                "No se pudo solicitar el cambio de correo",
            );
            throw new Error(message);
        }
    },

    confirmEmailChange: async (token: string): Promise<void> => {
        const response = await apiFetch("/api/v1/auth/confirm-email-change", {
            method: "POST",
            body: JSON.stringify({ token }),
        });
        if (!response.ok) {
            const message = await extractErrorMessage(
                response,
                "No se pudo confirmar el cambio de correo",
            );
            throw new Error(message);
        }
        clearSessionCache();
    },

    acceptWorkerInvitation: async (
        token: string,
        code: string,
        password: string,
    ): Promise<void> => {
        const response = await apiFetch("/api/v1/user-invitations/accept", {
            method: "POST",
            body: JSON.stringify(buildInvitationAcceptancePayload(token, code, password)),
        });
        if (!response.ok) {
            const errorMsg = await extractErrorMessage(response, "No se pudo activar tu acceso");
            throw new Error(errorMsg);
        }
    },
};
