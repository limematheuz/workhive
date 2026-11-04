import assert from "node:assert/strict";
import test from "node:test";

import {
    getContactValidationMessages,
    getInitialContactForm,
    prepareContactSubmission,
    syncContactFormLocale,
} from "./contact-form.ts";

const messages = getContactValidationMessages("es");

test("contact form initializes trial and plan reasons with localized subjects", () => {
    const trial = getInitialContactForm("trial", "es");
    assert.equal(trial.subject, "Solicitud de evaluación de WorkHive");
    assert.match(trial.message, /producto completo durante 14 días/);

    const plan = getInitialContactForm("plan-pro", "en");
    assert.equal(plan.subject, "pro plan onboarding");

    const regular = getInitialContactForm(null, "es");
    assert.equal(regular.subject, "");
});

test("syncContactFormLocale rewrites default subject and message on language switch", () => {
    const spanish = getInitialContactForm("trial", "es");
    const synced = syncContactFormLocale(spanish, "trial", "en");
    assert.equal(synced.subject, "WorkHive evaluation request");
    assert.match(synced.message, /full product access for 14 days/);

    const customized = syncContactFormLocale(
        { ...spanish, subject: "Custom subject", message: "Custom note" },
        "trial",
        "en",
    );
    assert.equal(customized.subject, "Custom subject");
    assert.equal(customized.message, "Custom note");
});

test("regular contact payload trims fields and normalizes email", () => {
    const result = prepareContactSubmission(
        {
            name: "  Matheus  ",
            email: "  USER@Example.COM  ",
            company_name: "Ignored",
            phone: "Ignored",
            subject: "  Soporte  ",
            message: "  Hola  ",
        },
        false,
        messages,
    );

    assert.deepEqual(result, {
        submission: {
            kind: "contact",
            payload: {
                name: "Matheus",
                email: "user@example.com",
                subject: "Soporte",
                message: "Hola",
            },
        },
        error: null,
    });
});

test("trial request payload requires company and keeps optional phone trimmed", () => {
    assert.equal(
        prepareContactSubmission(
            {
                name: "Matheus",
                email: "user@example.com",
                company_name: "   ",
                phone: "",
                subject: "Trial",
                message: "Necesito acceso",
            },
            true,
            messages,
        ).error,
        "Introduce el nombre de la empresa.",
    );

    const result = prepareContactSubmission(
        {
            name: " Matheus ",
            email: " USER@EXAMPLE.COM ",
            company_name: " WorkHive ",
            phone: " +34 600 000 000 ",
            subject: "Trial",
            message: " Necesito acceso ",
        },
        true,
        messages,
    );

    assert.deepEqual(result, {
        submission: {
            kind: "trial",
            payload: {
                full_name: "Matheus",
                email: "user@example.com",
                company_name: "WorkHive",
                phone: "+34 600 000 000",
                message: "Necesito acceso",
                requested_trial_days: 14,
            },
        },
        error: null,
    });
});

test("contact submission rejects blank required fields and invalid email", () => {
    assert.equal(
        prepareContactSubmission(
            {
                name: "Matheus",
                email: "invalid",
                company_name: "",
                phone: "",
                subject: "Soporte",
                message: "Hola",
            },
            false,
            messages,
        ).error,
        "Introduce un correo electrónico válido.",
    );

    assert.equal(
        prepareContactSubmission(
            {
                name: "Matheus",
                email: "user@example.com",
                company_name: "",
                phone: "",
                subject: "   ",
                message: "Hola",
            },
            false,
            messages,
        ).error,
        "Completa todos los campos obligatorios.",
    );
});


test("account access support starts with a localized subject and no private data", () => {
    for (const locale of ["es", "en"] as const) {
        const form = getInitialContactForm("account-access", locale);
        assert.equal(form.subject, locale === "es" ? "Revisar acceso a mi empresa" : "Review my company access");
        assert.equal(form.email, "");
        assert.equal(form.message, "");
    }
});
