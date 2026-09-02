import assert from "node:assert/strict";
import test from "node:test";

import { resolveInvitationToken } from "./invitation-token.ts";

test("invitation tokens prefer the fragment and can safely clear the URL", () => {
    assert.deepEqual(
        resolveInvitationToken({
            hash: "#token=fragment-secret",
            queryToken: "legacy-secret",
            fallbackToken: "persisted-secret",
        }),
        { token: "fragment-secret", source: "fragment", shouldClearUrl: true },
    );
});

test("invitation tokens retain legacy query links and the sign-in fallback", () => {
    assert.deepEqual(
        resolveInvitationToken({ hash: "", queryToken: "legacy-secret" }),
        { token: "legacy-secret", source: "query", shouldClearUrl: true },
    );
    assert.deepEqual(
        resolveInvitationToken({ hash: "", fallbackToken: "persisted-secret" }),
        { token: "persisted-secret", source: "fallback", shouldClearUrl: false },
    );
});

test("an empty fragment falls back to a valid legacy query token", () => {
    assert.deepEqual(
        resolveInvitationToken({
            hash: "#campaign=mail&token=%20",
            queryToken: "legacy-secret",
            fallbackToken: "persisted-secret",
        }),
        { token: "legacy-secret", source: "query", shouldClearUrl: true },
    );
});

test("invitation tokens decode URL-safe fragment values before they are retained", () => {
    assert.deepEqual(
        resolveInvitationToken({ hash: "#source=email&token=secret%2Dwith%5Funderscore" }),
        { token: "secret-with_underscore", source: "fragment", shouldClearUrl: true },
    );
});

test("invitation tokens reject blank values instead of treating an incomplete link as valid", () => {
    assert.deepEqual(
        resolveInvitationToken({ hash: "#token=%20%20", queryToken: " ", fallbackToken: "" }),
        { token: "", source: "missing", shouldClearUrl: false },
    );
});
