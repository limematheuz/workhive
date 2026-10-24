import assert from "node:assert/strict";
import test from "node:test";

import { createClientId, createEditableLineKey } from "./editable-line-key.ts";

test("creates a usable draft key when randomUUID is unavailable", () => {
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", { configurable: true, value: {} });

    try {
        assert.match(createClientId(), /^\d+-[a-z0-9]+$/);
        assert.match(createEditableLineKey("location-contact"), /^location-contact-\d+-[a-z0-9]+$/);
    } finally {
        if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
        else delete (globalThis as { crypto?: Crypto }).crypto;
    }
});
