import { isStrongPassword } from "./password-strength.ts";

export interface AuthFormMessages {
    emailRequired: string;
    invalidEmail: string;
    passwordRequired?: string;
    missingToken?: string;
    weakPassword?: string;
    passwordMismatch?: string;
}

export interface PreparedLoginCredentials {
    email: string;
    password: string;
}

export interface PreparedEmailChange {
    newEmail: string;
    currentPassword: string;
}

export type AuthFormLocale = "en" | "es";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const defaultAuthFormMessages: AuthFormMessages = {
    emailRequired: "Email is required.",
    invalidEmail: "Enter a valid email address.",
    passwordRequired: "Password is required.",
    missingToken: "Invalid link. Recovery token is missing.",
    weakPassword: "Password must meet all security requirements.",
    passwordMismatch: "Passwords do not match.",
};

export function getAuthFormMessages(locale: AuthFormLocale): AuthFormMessages {
    if (locale === "es") {
        return {
            emailRequired: "Introduce tu correo electrónico.",
            invalidEmail: "Introduce un correo electrónico válido.",
            passwordRequired: "Introduce tu contraseña.",
            missingToken: "Enlace inválido. El token de recuperación no está presente.",
            weakPassword: "La contraseña debe cumplir todos los requisitos de seguridad.",
            passwordMismatch: "Las contraseñas no coinciden.",
        };
    }
    return defaultAuthFormMessages;
}

export function normalizeAuthEmail(email: string): string {
    return email.trim().toLowerCase();
}

export function getAuthErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.trim() !== ""
        ? error.message
        : fallback;
}

export function validateAuthEmail(
    email: string,
    messages: Pick<AuthFormMessages, "emailRequired" | "invalidEmail"> = defaultAuthFormMessages,
): string | null {
    const normalizedEmail = normalizeAuthEmail(email);
    if (normalizedEmail === "") {
        return messages.emailRequired;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
        return messages.invalidEmail;
    }
    return null;
}

export function preparePasswordResetEmail(
    email: string,
    messages: Pick<AuthFormMessages, "emailRequired" | "invalidEmail"> = defaultAuthFormMessages,
): { email: string; error: string | null } {
    const normalizedEmail = normalizeAuthEmail(email);
    return {
        email: normalizedEmail,
        error: validateAuthEmail(normalizedEmail, messages),
    };
}

export function prepareEmailChangeRequest(
    newEmail: string,
    currentEmail: string,
    currentPassword: string,
    messages: Pick<AuthFormMessages, "emailRequired" | "invalidEmail" | "passwordRequired"> = defaultAuthFormMessages,
): { request: PreparedEmailChange | null; error: string | null } {
    const normalizedEmail = normalizeAuthEmail(newEmail);
    const emailError = validateAuthEmail(normalizedEmail, messages);
    if (emailError !== null) {
        return { request: null, error: emailError };
    }
    if (normalizedEmail === normalizeAuthEmail(currentEmail)) {
        return {
            request: null,
            error: "The new email must be different from the current email.",
        };
    }
    if (currentPassword === "") {
        return {
            request: null,
            error: messages.passwordRequired ?? "Password is required.",
        };
    }
    return {
        request: {
            newEmail: normalizedEmail,
            currentPassword,
        },
        error: null,
    };
}

export function prepareLoginCredentials(
    email: string,
    password: string,
    messages: AuthFormMessages = defaultAuthFormMessages,
): { credentials: PreparedLoginCredentials | null; error: string | null } {
    const normalizedEmail = normalizeAuthEmail(email);
    const emailError = validateAuthEmail(normalizedEmail, messages);
    if (emailError !== null) {
        return { credentials: null, error: emailError };
    }
    if (password === "") {
        return {
            credentials: null,
            error: messages.passwordRequired ?? defaultAuthFormMessages.passwordRequired ?? "Password is required.",
        };
    }
    return {
        credentials: {
            email: normalizedEmail,
            password,
        },
        error: null,
    };
}

export function preparePasswordResetRequest(
    token: string,
    password: string,
    confirmPassword: string,
    messages: AuthFormMessages = defaultAuthFormMessages,
): { token: string; password: string; error: string | null } {
    const trimmedToken = token.trim();
    if (trimmedToken === "") {
        return {
            token: trimmedToken,
            password,
            error: messages.missingToken ?? "Invalid link. Recovery token is missing.",
        };
    }
    if (!isStrongPassword(password)) {
        return {
            token: trimmedToken,
            password,
            error: messages.weakPassword ?? "Password must meet all security requirements.",
        };
    }
    if (password !== confirmPassword) {
        return {
            token: trimmedToken,
            password,
            error: messages.passwordMismatch ?? "Passwords do not match.",
        };
    }
    return {
        token: trimmedToken,
        password,
        error: null,
    };
}
