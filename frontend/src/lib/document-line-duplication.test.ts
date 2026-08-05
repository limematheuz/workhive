import assert from "node:assert/strict";
import test from "node:test";

import { duplicateDocumentLine } from "./document-line-duplication.ts";

test("duplicateDocumentLine keeps values and inserts the copy after its source", () => {
    const rows = [
        { id: "first", description: "Limpieza", unitPrice: 95, quantity: 1 },
        { id: "second", description: "Desplazamiento", unitPrice: 53.76, quantity: 1 },
    ];

    const duplicated = duplicateDocumentLine(rows, "first", (source) => ({ ...source, id: "copy" }));

    assert.deepEqual(duplicated.map((row) => row.id), ["first", "copy", "second"]);
    assert.deepEqual(duplicated[1], { id: "copy", description: "Limpieza", unitPrice: 95, quantity: 1 });
    assert.equal(duplicateDocumentLine(rows, "missing", (source) => source), rows);
});
