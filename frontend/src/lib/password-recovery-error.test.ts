import assert from "node:assert/strict";
import test from "node:test";
import { ApiResponseError } from "./api.ts";
import { getPasswordRecoveryErrorMessage } from "./password-recovery-error.ts";

test("password recovery outages show localized feedback without server details", () => {
    const error = new ApiResponseError("Password recovery email is not configured", 503);
    assert.equal(
        getPasswordRecoveryErrorMessage(error, "es"),
        "No hemos podido enviar el enlace de recuperación. Inténtalo de nuevo más tarde.",
    );
    assert.equal(
        getPasswordRecoveryErrorMessage(error, "en"),
        "We could not send the recovery link. Please try again later.",
    );
});

test("password recovery network failures use the same retry feedback", () => {
    assert.equal(
        getPasswordRecoveryErrorMessage(new TypeError("Failed to fetch"), "es"),
        "No hemos podido enviar el enlace de recuperación. Inténtalo de nuevo más tarde.",
    );
});

test("password recovery preserves actionable client errors", () => {
    const error = new ApiResponseError("Demasiadas solicitudes. Inténtalo más tarde.", 429);
    assert.equal(getPasswordRecoveryErrorMessage(error, "es"), error.message);
});
