import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/invoices/InvoiceTaskSelector.tsx", import.meta.url), "utf8");

test("invoice task selector uses one interactive checkbox control per task", () => {
    assert.match(source, /role="checkbox"/);
    assert.match(source, /aria-checked=\{isChecked\}/);
    assert.match(source, /<Check className="size-3"/);
    assert.doesNotMatch(source, /<Checkbox\b/);
});
