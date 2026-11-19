import { ApiResponseError } from "./api.ts";

export type LoginAccessBlock = "trial_expired" | "unavailable";
export type LoginFailureReason = "credentials" | "rate_limit" | "user_inactive" | "company_inactive" | "unavailable";

export function getLoginFailureReason(error: unknown): LoginFailureReason {
    if (error instanceof ApiResponseError) {
        if (error.status === 401) return "credentials";
        if (error.status === 429) return "rate_limit";
        if (error.status === 400 && error.code === "auth.user_inactive") return "user_inactive";
        if (error.status === 403 && error.code === "auth.company_inactive") return "company_inactive";
    }
    return "unavailable";
}

export function getLoginFailureMessage(reason: LoginFailureReason, locale: "es" | "en"): string {
    const messages = {
        credentials: { es: "Revisa el correo y la contraseña.", en: "Check your email and password." },
        rate_limit: { es: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.", en: "Too many attempts. Wait a few minutes and try again." },
        user_inactive: { es: "Tu cuenta está desactivada. Contacta con el administrador de tu empresa para recuperar el acceso.", en: "Your account is deactivated. Contact your company administrator to restore access." },
        company_inactive: { es: "El acceso de tu empresa está desactivado. Contacta con su administrador para revisar el estado de la empresa.", en: "Your company's access is deactivated. Contact its administrator to review the company status." },
        unavailable: { es: "El acceso no está disponible temporalmente. Inténtalo de nuevo en un momento.", en: "Sign-in is temporarily unavailable. Please try again in a moment." },
    };
    return messages[reason][locale];
}

export function getLoginAccessBlock(error: unknown): LoginAccessBlock | null {
    if (!(error instanceof ApiResponseError) || error.status !== 402) return null;
    return error.code === "subscription.trial_expired" ? "trial_expired" : "unavailable";
}
