import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    LOGIN_SUCCESS_REDIRECT_MS,
    loginStatusRedirectDelayMs,
    resolveLoginStatusPhrases,
} from "./login-status.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("resolveLoginStatusPhrases keeps non-empty copy and falls back", () => {
    assert.deepEqual(resolveLoginStatusPhrases("success", ["  One ", "", "Two"], "Fallback"), [
        "One",
        "Two",
    ]);
    assert.deepEqual(resolveLoginStatusPhrases("error", [], "Could not sign in."), [
        "Could not sign in.",
    ]);
    assert.deepEqual(resolveLoginStatusPhrases("error", undefined, "Could not sign in."), [
        "Could not sign in.",
    ]);
});

test("success redirect delay waits for phrase animation", () => {
    assert.ok(loginStatusRedirectDelayMs(1) >= LOGIN_SUCCESS_REDIRECT_MS);
    assert.ok(loginStatusRedirectDelayMs(3) > loginStatusRedirectDelayMs(1));
});

test("login status feedback reuses one panel for fail and success (accent blue)", () => {
    const feedback = read("../components/auth/LoginStatusFeedback.tsx");
    const login = read("../components/auth/LoginFormPanel.tsx");
    const es = JSON.parse(read("../dictionaries/es.json"));
    const en = JSON.parse(read("../dictionaries/en.json"));

    assert.match(feedback, /data-login-status=\{variant\}/);
    assert.match(feedback, /LoginErrorIllustration/);
    assert.match(feedback, /LoginSuccessIllustration/);
    assert.match(feedback, /login-status-phrase/);
    assert.match(feedback, /text-accent/);
    assert.match(login, /LoginStatusFeedback/);
    assert.match(login, /variant="success"/);
    assert.match(login, /variant="error"/);
    assert.ok(Array.isArray(es.auth.login_fail_phrases));
    assert.ok(Array.isArray(es.auth.login_success_phrases));
    assert.ok(Array.isArray(en.auth.login_fail_phrases));
    assert.ok(Array.isArray(en.auth.login_success_phrases));
    assert.ok(es.auth.login_fail_phrases.length >= 2);
    assert.ok(es.auth.login_success_phrases.length >= 2);
    assert.ok(en.auth.login_fail_phrases.length >= 2);
    assert.ok(en.auth.login_success_phrases.length >= 2);
});
