import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("invoice draft edits persist the header and complete line snapshot once", () => {
    const source = readFileSync(
        new URL("../hooks/useInvoiceDetail.ts", import.meta.url),
        "utf8",
    );

    assert.doesNotMatch(
        source,
        /InvoiceService\.(create|update|delete)InvoiceItem/,
    );
    assert.match(source, /InvoiceService\.updateInvoice\(invoice\.id,/);
    assert.match(source, /items:\s*editingItems\.map\(/);
    assert.match(source, /task_item_id:\s*item\.task_item_id/);
    assert.match(source, /validateDocumentLines\(/);
});
