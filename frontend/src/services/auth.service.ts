import { apiFetch, extractErrorMessage } from "@/lib/api";
import { setCsrfToken } from "@/lib/auth";
import { getVisitorId } from "@/lib/visitor-id";
import { User } from "@/types/user";

export const authService = {
    getMe: async (): Promise<User> => {
        const response = await apiFetch("/api/v1/users/me", {
            method: "GET",
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error("Failed to fetch user profile");
        }
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
            throw new Error("Invalid Credentials. Check your email and password.");
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

        if (!response.ok) {
            const errorMsg = await extractErrorMessage(response, "No se pudo procesar la solicitud de recuperación");
            throw new Error(errorMsg);
        }
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
};
