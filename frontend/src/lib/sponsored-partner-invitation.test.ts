import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("a sponsored property manager is created through a portal-only invitation", () => {
    const service = source("../services/sponsored-partner-invitation.service.ts");
    const acceptance = source("../app/(auth)/accept-sponsored-partner-invitation/AcceptSponsoredPartnerInvitationClient.tsx");
    const api = source("./api.ts");

    assert.match(service, /\/api\/v1\/collaborations\/sponsored-invitations/);
    assert.match(service, /assertApiResponseOk/);
    assert.match(acceptance, /PasswordCreationFields/);
    assert.match(acceptance, /resolveInvitationToken/);
    assert.match(acceptance, /sponsoredPartnerInvitationService\.accept/);
    assert.match(api, /\/api\/v1\/collaborations\/sponsored-invitations\/accept/);
});
