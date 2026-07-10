export type PasswordCheck = {
    valid: boolean;
    label: string;
};

export type PasswordScore = {
    score: number;
    label: string;
    colorClass: string;
    fillClass: string;
};

export function getPasswordChecks(password: string, locale: string = "es"): PasswordCheck[] {
    return [
        {
            valid: password.length >= 8,
            label: locale === "es" ? "Mínimo 8 caracteres" : "Minimum 8 characters",
        },
        {
            valid: /[a-z]/.test(password),
            label: locale === "es" ? "Al menos una minúscula" : "At least one lowercase letter",
        },
        {
            valid: /[A-Z]/.test(password),
            label: locale === "es" ? "Al menos una mayúscula" : "At least one uppercase letter",
        },
        {
            valid: /\d/.test(password),
            label: locale === "es" ? "Al menos un número" : "At least one number",
        },
        {
            valid: /[^A-Za-z0-9]/.test(password),
            label: locale === "es" ? "Al menos un carácter especial" : "At least one special character",
        },
    ];
}

export function getPasswordStrength(password: string, locale: string = "es"): PasswordScore {
    const checks = getPasswordChecks(password, locale);
    const score = checks.filter((check) => check.valid).length;
    if (score <= 2) {
        return {
            score,
            label: locale === "es" ? "Floja" : "Weak",
            colorClass: "text-red-500",
            fillClass: "bg-red-500",
        };
    }
    if (score <= 4) {
        return {
            score,
            label: locale === "es" ? "Media" : "Medium",
            colorClass: "text-amber-500",
            fillClass: "bg-amber-500",
        };
    }
    return {
        score,
        label: locale === "es" ? "Alta" : "High",
        colorClass: "text-emerald-500",
        fillClass: "bg-emerald-500",
    };
}

export function isStrongPassword(password: string): boolean {
    return getPasswordChecks(password).every((check) => check.valid);
}
