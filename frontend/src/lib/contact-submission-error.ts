import { ApiResponseError } from "./api.ts";
import type { AuthFormLocale } from "./auth-forms.ts";

export function getContactSubmissionErrorMessage(error: unknown, locale: AuthFormLocale): string {
    if (error instanceof ApiResponseError && error.status >= 400 && error.status < 500) {
        return error.message;
    }

    return locale === "es"
        ? "No hemos podido completar el envío. Inténtalo de nuevo más tarde."
        : "We could not complete your submission. Please try again later.";
}
