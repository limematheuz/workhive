import assert from "node:assert/strict";
import test from "node:test";
import { ApiResponseError } from "./api.ts";
import { getContactSubmissionErrorMessage } from "./contact-submission-error.ts";

test("contact and trial outages show localized feedback without server details", () => {
    for (const status of [500, 502, 503]) {
        const error = new ApiResponseError("Internal mail configuration details", status);
        assert.equal(
            getContactSubmissionErrorMessage(error, "es"),
            "No hemos podido completar el envío. Inténtalo de nuevo más tarde.",
        );
        assert.equal(
            getContactSubmissionErrorMessage(error, "en"),
            "We could not complete your submission. Please try again later.",
        );
    }
});

test("contact network failures and unknown errors remain safe and actionable", () => {
    for (const error of [new TypeError("Failed to fetch"), new Error("Private details"), null]) {
        assert.equal(
            getContactSubmissionErrorMessage(error, "es"),
            "No hemos podido completar el envío. Inténtalo de nuevo más tarde.",
        );
    }
});

test("contact preserves actionable client errors and localizes backend duplicate/rate-limit messages", () => {
    const customError = new ApiResponseError("Esta cuenta ya existe.", 409);
    assert.equal(getContactSubmissionErrorMessage(customError, "es"), "Esta cuenta ya existe.");

    const duplicateBackendError = new ApiResponseError("This email already has a WorkHive account", 409);
    assert.equal(
        getContactSubmissionErrorMessage(duplicateBackendError, "es"),
        "Este correo ya tiene una cuenta en WorkHive.",
    );
    assert.equal(
        getContactSubmissionErrorMessage(duplicateBackendError, "en"),
        "This email already has a WorkHive account.",
    );

    const rateLimitError = new ApiResponseError("Too many requests. Please retry later.", 429);
    assert.equal(
        getContactSubmissionErrorMessage(rateLimitError, "es"),
        "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
    );
    assert.equal(
        getContactSubmissionErrorMessage(rateLimitError, "en"),
        "Too many attempts. Wait a moment and try again.",
    );
});
