import assert from "node:assert/strict";
import test from "node:test";

import { buildPrivacyResolutionPayload } from "./privacy-request.ts";


test("privacy resolution sends only the decision and the administrator message", () => {
    assert.deepEqual(
        buildPrivacyResolutionPayload("complete", "  Identity verified.  "),
        {
            decision: "complete",
            resolution_notes: "Identity verified.",
        },
    );
});

test("privacy request types have readable Spanish and English labels", async () => {
    const { getPrivacyRequestTypeLabel } = await import("./privacy-request.ts");
    const labels = [
        ["access", "Acceso", "Access"],
        ["rectification", "Rectificación", "Rectification"],
        ["erasure", "Supresión", "Erasure"],
        ["restriction", "Limitación del tratamiento", "Restriction of processing"],
        ["portability", "Portabilidad", "Portability"],
        ["objection", "Oposición", "Objection"],
    ];
    for (const [type, spanish, english] of labels) {
        assert.equal(getPrivacyRequestTypeLabel(type, true), spanish);
        assert.equal(getPrivacyRequestTypeLabel(type, false), english);
    }
    assert.equal(getPrivacyRequestTypeLabel("unknown", true), "Solicitud de privacidad");
    assert.equal(getPrivacyRequestTypeLabel("toString", false), "Privacy request");
});
