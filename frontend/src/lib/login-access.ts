import { ApiResponseError } from "./api.ts";

export type LoginAccessBlock = "trial_expired" | "unavailable";
export type LoginFailureReason = "credentials" | "rate_limit" | "unavailable";

export function getLoginFailureReason(error: unknown): LoginFailureReason {
    if (error instanceof ApiResponseError) {
        if (error.status === 401) return "credentials";
        if (error.status === 429) return "rate_limit";
    }
    return "unavailable";
}

export function getLoginFailureMessage(reason: LoginFailureReason, locale: "es" | "en"): string {
    const messages = {
        credentials: { es: "Revisa el correo y la contraseña.", en: "Check your email and password." },
        rate_limit: { es: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.", en: "Too many attempts. Wait a few minutes and try again." },
        unavailable: { es: "El acceso no está disponible temporalmente. Inténtalo de nuevo en un momento.", en: "Sign-in is temporarily unavailable. Please try again in a moment." },
    };
    return messages[reason][locale];
}

export function getLoginAccessBlock(error: unknown): LoginAccessBlock | null {
    if (!(error instanceof ApiResponseError) || error.status !== 402) return null;
    return error.code === "subscription.trial_expired" ? "trial_expired" : "unavailable";
}
