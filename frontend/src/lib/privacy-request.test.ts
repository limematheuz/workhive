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
