import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";


const serviceSource = readFileSync(
    new URL("../services/auth.service.ts", import.meta.url),
    "utf8",
);
const profileSource = readFileSync(
    new URL("../components/profile/EmailChangeForm.tsx", import.meta.url),
    "utf8",
);
const confirmationSource = readFileSync(
    new URL("../app/(auth)/confirm-email-change/page.tsx", import.meta.url),
    "utf8",
);
const apiSource = readFileSync(new URL("./api.ts", import.meta.url), "utf8");


test("email change request sends the password and new email only in the body", () => {
    assert.match(serviceSource, /request-email-change/);
    assert.match(serviceSource, /new_email: newEmail/);
    assert.match(serviceSource, /current_password: currentPassword/);
    assert.doesNotMatch(serviceSource, /request-email-change\?/);
});


test("profile requires the current password and explains pending verification", () => {
    assert.match(profileSource, /autoComplete="current-password"/);
    assert.match(profileSource, /requestEmailChange/);
    assert.match(profileSource, /email_change_sent/);
});


test("confirmation token is removed from the URL and submitted in a POST body", () => {
    assert.match(confirmationSource, /window\.location\.hash/);
    assert.match(confirmationSource, /hashParams\.get\("token"\)/);
    assert.match(confirmationSource, /confirmEmailChange\(token\)/);
    assert.match(serviceSource, /JSON\.stringify\(\{ token \}\)/);
    assert.doesNotMatch(serviceSource, /confirm-email-change\?/);
});


test("confirmation is CSRF-exempt while the authenticated request stays protected", () => {
    assert.match(apiSource, /"\/api\/v1\/auth\/confirm-email-change"/);
    const exemptBlock = apiSource.match(/const CSRF_EXEMPT_PATHS = new Set\(\[([\s\S]*?)\]\);/)?.[1] || "";
    assert.doesNotMatch(exemptBlock, /request-email-change/);
});
