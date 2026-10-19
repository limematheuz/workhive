import { ApiResponseError } from "./api.ts";
import type { AuthFormLocale } from "./auth-forms.ts";

export function getPasswordRecoveryErrorMessage(error: unknown, locale: AuthFormLocale): string {
    if (error instanceof ApiResponseError && error.status >= 400 && error.status < 500) {
        return error.message;
    }

    return locale === "es"
        ? "No hemos podido enviar el enlace de recuperación. Inténtalo de nuevo más tarde."
        : "We could not send the recovery link. Please try again later.";
}
