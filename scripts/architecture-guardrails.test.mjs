import assert from "node:assert/strict";
import test from "node:test";

import { runArchitectureGuardrails } from "./architecture-guardrails.mjs";

test("architecture guardrails keep modules and layer boundaries focused", () => {
    assert.doesNotThrow(runArchitectureGuardrails);
});
