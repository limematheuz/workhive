import assert from "node:assert/strict";
import test from "node:test";

import {
    buildInvitationAcceptancePayload,
    buildWorkerInvitationPayload,
} from "./user-invitation.ts";


test("worker invitation payload normalizes the email and never contains a password", () => {
    const payload = buildWorkerInvitationPayload({
        email: "  WORKER@WorkHive.test ",
        full_name: "  Worker Name  ",
        role_id: 3,
    });

    assert.deepEqual(payload, {
        email: "worker@workhive.test",
        full_name: "Worker Name",
        role_id: 3,
    });
    assert.equal("password" in payload, false);
    assert.equal("access_code" in payload, false);
});

test("invitation acceptance payload keeps the verification secret out of URLs and uses mandatory legal consent", () => {
    assert.deepEqual(
        buildInvitationAcceptancePayload("token-value", "12345678", "StrongPass1!"),
        {
            token: "token-value",
            code: "12345678",
            password: "StrongPass1!",
            accept_terms: true,
            accept_privacy: true,
            marketing_consent: false,
        },
    );
});
