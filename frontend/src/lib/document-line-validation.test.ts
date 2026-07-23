import assert from "node:assert/strict";
import test from "node:test";

import { validateDocumentLines } from "./document-line-validation.ts";

test("document lines require at least one complete non-negative concept", () => {
    assert.equal(validateDocumentLines([]), "empty");
    assert.equal(
        validateDocumentLines([
            { description: "  ", quantity: 1, unitPrice: 10 },
        ]),
        "description",
    );
    assert.equal(
        validateDocumentLines([
            { description: "Limpieza", quantity: 0, unitPrice: 10 },
        ]),
        "quantity",
    );
    assert.equal(
        validateDocumentLines([
            { description: "Limpieza", quantity: 1, unitPrice: -1 },
        ]),
        "unit-price",
    );
    assert.equal(
        validateDocumentLines([
            { description: " Limpieza ", quantity: 1, unitPrice: 0 },
        ]),
        null,
    );
});
