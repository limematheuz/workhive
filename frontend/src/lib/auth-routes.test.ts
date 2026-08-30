import assert from "node:assert/strict";
import test from "node:test";

import {
    DEFAULT_POST_LOGIN_PATH,
    isAuthenticationEntryPath,
    requiresAuthenticatedSession,
    resolvePostLoginPath,
} from "./auth-routes.ts";

test("only application actions require an authenticated session", () => {
    assert.equal(requiresAuthenticatedSession("/dashboard"), true);
    assert.equal(requiresAuthenticatedSession("/dashboard/invoices/6"), true);
    assert.equal(requiresAuthenticatedSession("/subscription/checkout"), true);
    assert.equal(requiresAuthenticatedSession("/subscription"), false);
    assert.equal(requiresAuthenticatedSession("/contact"), false);
});

test("post-login routing preserves supported local paths and rejects redirects", () => {
    assert.equal(resolvePostLoginPath("/dashboard/invoices/6?tab=items"), "/dashboard/invoices/6?tab=items");
    assert.equal(resolvePostLoginPath("/subscription/checkout?plan=pro"), "/subscription/checkout?plan=pro");
    assert.equal(resolvePostLoginPath("/accept-company-invitation?token=opaque"), "/accept-company-invitation?token=opaque");
    assert.equal(resolvePostLoginPath("//outside.example"), DEFAULT_POST_LOGIN_PATH);
    assert.equal(resolvePostLoginPath("https://outside.example"), DEFAULT_POST_LOGIN_PATH);
    assert.equal(resolvePostLoginPath("/subscription"), DEFAULT_POST_LOGIN_PATH);
});

test("only login and registration are authentication entry screens", () => {
    assert.equal(isAuthenticationEntryPath("/login"), true);
    assert.equal(isAuthenticationEntryPath("/register"), true);
    assert.equal(isAuthenticationEntryPath("/forgot-password"), false);
    assert.equal(isAuthenticationEntryPath("/subscription"), false);
});
