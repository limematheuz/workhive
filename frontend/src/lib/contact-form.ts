import { normalizeAuthEmail, validateAuthEmail, type AuthFormLocale } from "./auth-forms.ts";

export type ContactReason = string | null;

export interface ContactFormState {
    name: string;
    email: string;
    company_name: string;
    phone: string;
    subject: string;
    message: string;
}

interface PreparedTrialSubmission {
    kind: "trial";
    payload: {
        full_name: string;
        email: string;
        company_name: string;
        phone: string;
        message: string;
        requested_trial_days: number;
    };
}

interface PreparedContactMessageSubmission {
    kind: "contact";
    payload: {
        name: string;
        email: string;
        subject: string;
        message: string;
    };
}

export type PreparedContactSubmission =
    | PreparedTrialSubmission
    | PreparedContactMessageSubmission;

export interface ContactValidationMessages {
    required: string;
    invalidEmail: string;
    companyRequired: string;
}

export function getContactValidationMessages(locale: AuthFormLocale): ContactValidationMessages {
    if (locale === "es") {
        return {
            required: "Completa todos los campos obligatorios.",
            invalidEmail: "Introduce un correo electrónico válido.",
            companyRequired: "Introduce el nombre de la empresa.",
        };
    }
    return {
        required: "Complete every required field.",
        invalidEmail: "Enter a valid email address.",
        companyRequired: "Enter the company name.",
    };
}

function trimForm(form: ContactFormState): ContactFormState {
    return {
        name: form.name.trim(),
        email: normalizeAuthEmail(form.email),
        company_name: form.company_name.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
    };
}

export function getInitialContactForm(reason: ContactReason, locale: AuthFormLocale): ContactFormState {
    if (reason === "trial") {
        return {
            name: "",
            email: "",
            company_name: "",
            phone: "",
            subject: locale === "es" ? "Solicitud de evaluación de WorkHive" : "WorkHive evaluation request",
            message: locale === "es"
                ? "Hola equipo de WorkHive,\n\nMe gustaría solicitar una evaluación asistida de 14 días para mi empresa.\n\nGracias."
                : "Hello WorkHive Team,\n\nI would like to request a 14-day assisted evaluation for my company.\n\nThank you.",
        };
    }
    if (reason?.startsWith("plan-")) {
        const plan = reason.replace("plan-", "").trim();
        return {
            name: "",
            email: "",
            company_name: "",
            phone: "",
            subject: locale === "es" ? `Contratación del plan ${plan}` : `${plan} plan onboarding`,
            message: "",
        };
    }
    return {
        name: "",
        email: "",
        company_name: "",
        phone: "",
        subject: "",
        message: "",
    };
}

export function prepareContactSubmission(
    form: ContactFormState,
    isTrialRequest: boolean,
    messages: ContactValidationMessages,
): { submission: PreparedContactSubmission | null; error: string | null } {
    const normalized = trimForm(form);
    const emailError = validateAuthEmail(normalized.email, {
        emailRequired: messages.required,
        invalidEmail: messages.invalidEmail,
    });

    if (normalized.name === "" || normalized.message === "" || emailError !== null) {
        return {
            submission: null,
            error: emailError ?? messages.required,
        };
    }

    if (isTrialRequest) {
        if (normalized.company_name === "") {
            return {
                submission: null,
                error: messages.companyRequired,
            };
        }
        return {
            submission: {
                kind: "trial",
                payload: {
                    full_name: normalized.name,
                    email: normalized.email,
                    company_name: normalized.company_name,
                    phone: normalized.phone,
                    message: normalized.message,
                    requested_trial_days: 14,
                },
            },
            error: null,
        };
    }

    if (normalized.subject === "") {
        return {
            submission: null,
            error: messages.required,
        };
    }

    return {
        submission: {
            kind: "contact",
            payload: {
                name: normalized.name,
                email: normalized.email,
                subject: normalized.subject,
                message: normalized.message,
            },
        },
        error: null,
    };
}
