import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildQuoteItemsSnapshot } from "./quote-form.ts";

test("quote item snapshots contain only the persisted business fields", () => {
    const snapshot = buildQuoteItemsSnapshot([
        {
            id: "existing-1",
            description: " Limpieza ",
            quantity: 2,
            unitPrice: 35,
            taxRate: 0.21,
        },
    ]);

    assert.deepEqual(snapshot, [
        { description: "Limpieza", quantity: 2, unit_price: 35 },
    ]);
});

test("quote editors save header and item snapshot through one request", () => {
    const createHook = readFileSync(
        new URL("../hooks/useQuoteForm.ts", import.meta.url),
        "utf8",
    );
    const detailHook = readFileSync(
        new URL("../hooks/useQuoteDetail.ts", import.meta.url),
        "utf8",
    );

    for (const source of [createHook, detailHook]) {
        assert.doesNotMatch(source, /QuoteService\.(create|update|delete)QuoteItem/);
        assert.match(source, /items:\s*buildQuoteItemsSnapshot\(/);
    }
});
