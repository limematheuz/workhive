import assert from "node:assert/strict";
import test from "node:test";

import {
    getAuthErrorMessage,
    normalizeAuthEmail,
    prepareLoginCredentials,
    preparePasswordResetRequest,
    preparePasswordResetEmail,
    validateAuthEmail,
} from "./auth-forms.ts";

const messages = {
    emailRequired: "Correo requerido",
    invalidEmail: "Correo inválido",
    passwordRequired: "Contraseña requerida",
    missingToken: "Token requerido",
    weakPassword: "Contraseña débil",
    passwordMismatch: "Contraseñas distintas",
};

test("auth email is normalized before login and password reset calls", () => {
    assert.equal(normalizeAuthEmail("  USER@Example.COM  "), "user@example.com");
});

test("auth email validation rejects blank and malformed values", () => {
    assert.equal(validateAuthEmail("   ", messages), "Correo requerido");
    assert.equal(validateAuthEmail("matheus@", messages), "Correo inválido");
    assert.equal(validateAuthEmail("matheus@example.com", messages), null);
});

test("password reset request returns normalized email and validation error", () => {
    assert.deepEqual(
        preparePasswordResetEmail("  OWNER@WORKHIVE.TEST  ", messages),
        {
            email: "owner@workhive.test",
            error: null,
        },
    );
    assert.deepEqual(
        preparePasswordResetEmail("owner", messages),
        {
            email: "owner",
            error: "Correo inválido",
        },
    );
});

test("login credentials preserve password exactly while normalizing email", () => {
    assert.deepEqual(
        prepareLoginCredentials("  ADMIN@WORKHIVE.TEST ", "  keep spaces  ", messages),
        {
            credentials: {
                email: "admin@workhive.test",
                password: "  keep spaces  ",
            },
            error: null,
        },
    );
});

test("login credentials reject empty email and empty password", () => {
    assert.deepEqual(
        prepareLoginCredentials("", "secret", messages),
        {
            credentials: null,
            error: "Correo requerido",
        },
    );
    assert.deepEqual(
        prepareLoginCredentials("admin@workhive.test", "", messages),
        {
            credentials: null,
            error: "Contraseña requerida",
        },
    );
});

test("auth error message falls back for unknown or empty errors", () => {
    assert.equal(getAuthErrorMessage(new Error("Invalid credentials"), "Fallback"), "Invalid credentials");
    assert.equal(getAuthErrorMessage(new Error(""), "Fallback"), "Fallback");
    assert.equal(getAuthErrorMessage("boom", "Fallback"), "Fallback");
});

test("password reset request validates token strength and matching confirmation", () => {
    assert.deepEqual(
        preparePasswordResetRequest("   ", "StrongPass1!", "StrongPass1!", messages),
        {
            token: "",
            password: "StrongPass1!",
            error: "Token requerido",
        },
    );
    assert.deepEqual(
        preparePasswordResetRequest("token", "weak", "weak", messages),
        {
            token: "token",
            password: "weak",
            error: "Contraseña débil",
        },
    );
    assert.deepEqual(
        preparePasswordResetRequest(" token ", "StrongPass1!", "StrongPass2!", messages),
        {
            token: "token",
            password: "StrongPass1!",
            error: "Contraseñas distintas",
        },
    );
    assert.deepEqual(
        preparePasswordResetRequest(" token ", "StrongPass1!", "StrongPass1!", messages),
        {
            token: "token",
            password: "StrongPass1!",
            error: null,
        },
    );
});
