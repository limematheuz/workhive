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

test("contact preserves actionable client errors such as a duplicate account", () => {
    const error = new ApiResponseError("Esta cuenta ya existe.", 409);
    assert.equal(getContactSubmissionErrorMessage(error, "es"), "Esta cuenta ya existe.");
});
