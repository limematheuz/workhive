import assert from "node:assert/strict";
import test from "node:test";

import { ApiResponseError } from "./api.ts";
import {
    classifyReadError,
    getApiErrorStatus,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    isReadAccessDeniedError,
    shouldShowReadRetry,
} from "./read-recovery.ts";

test("read recovery classifies 401/403/404 as denied and transient errors as unavailable", () => {
    for (const status of [401, 403, 404]) {
        const err = new ApiResponseError("Forbidden", status);
        assert.equal(getApiErrorStatus(err), status);
        assert.equal(isReadAccessDeniedError(err), true);
        assert.equal(classifyReadError(err), "denied");
        assert.equal(shouldShowReadRetry("denied"), false);
    }

    for (const err of [new ApiResponseError("Unavailable", 503), new TypeError("Failed to fetch"), "unknown"]) {
        assert.equal(isReadAccessDeniedError(err), false);
        assert.equal(classifyReadError(err), "unavailable");
    }
    assert.equal(shouldShowReadRetry("unavailable"), true);
    assert.equal(shouldShowReadRetry(null), false);
});

test("read recovery resolves localized messages dynamically from kind", () => {
    const esCopy = { unavailable: "No se pudieron cargar.", denied: "Sin permisos." };
    const enCopy = { unavailable: "Could not load.", denied: "Permission denied." };

    assert.equal(getReadRecoveryMessage("unavailable", esCopy), "No se pudieron cargar.");
    assert.equal(getReadRecoveryMessage("unavailable", enCopy), "Could not load.");
    assert.equal(getReadRecoveryMessage("denied", esCopy), "Sin permisos.");
    assert.equal(getReadRecoveryMessage("denied", enCopy), "Permission denied.");
    assert.equal(getReadRecoveryMessage(null, esCopy), null);
});

test("workspace key isolates company and user identity", () => {
    assert.equal(getReadWorkspaceKey({ company_id: 11, id: 46 }), "11:46");
    assert.equal(getReadWorkspaceKey({ company_id: 7, id: 46 }), "7:46");
    assert.equal(getReadWorkspaceKey(null), "none:anon");
});
