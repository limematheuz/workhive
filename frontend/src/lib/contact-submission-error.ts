import { ApiResponseError } from "./api.ts";
import type { AuthFormLocale } from "./auth-forms.ts";

const DUPLICATE_TRIAL_ACCOUNT_MESSAGE = "this email already has a workhive account";

export function getContactSubmissionErrorMessage(error: unknown, locale: AuthFormLocale): string {
    if (error instanceof ApiResponseError) {
        if (error.status === 429) {
            return locale === "es"
                ? "Demasiados intentos. Espera un momento e inténtalo de nuevo."
                : "Too many attempts. Wait a moment and try again.";
        }
        if (
            error.status === 409 &&
            error.message.trim().toLowerCase() === DUPLICATE_TRIAL_ACCOUNT_MESSAGE
        ) {
            return locale === "es"
                ? "Este correo ya tiene una cuenta en WorkHive."
                : "This email already has a WorkHive account.";
        }
        if (error.status >= 400 && error.status < 500) {
            return error.message;
        }
    }

    return locale === "es"
        ? "No hemos podido completar el envío. Inténtalo de nuevo más tarde."
        : "We could not complete your submission. Please try again later.";
}
