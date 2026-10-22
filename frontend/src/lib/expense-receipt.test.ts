import assert from "node:assert/strict";
import test from "node:test";

import { isPrivateExpenseReceipt, MAX_EXPENSE_RECEIPT_BYTES, validateExpenseReceiptFile } from "./expense-receipt.ts";

test("only expense-bound private references show a protected download", () => {
    assert.equal(isPrivateExpenseReceipt("private-expense-receipt:company/1/expense-receipts/2/a.pdf"), true);
    assert.equal(isPrivateExpenseReceipt("https://example.invalid/old-receipt.pdf"), false);
    assert.equal(isPrivateExpenseReceipt(null), false);
});

test("receipt selection rejects empty, oversized and unsupported files", () => {
    assert.equal(validateExpenseReceiptFile(new File([], "empty.pdf", { type: "application/pdf" })), "empty");
    assert.equal(validateExpenseReceiptFile(new File([new Uint8Array(MAX_EXPENSE_RECEIPT_BYTES + 1)], "large.pdf", { type: "application/pdf" })), "too_large");
    assert.equal(validateExpenseReceiptFile(new File(["text"], "text.txt", { type: "text/plain" })), "invalid_type");
    assert.equal(validateExpenseReceiptFile(new File(["test"], "small.pdf", { type: "application/pdf" })), null);
});
