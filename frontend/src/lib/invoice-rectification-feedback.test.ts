import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getInvoiceNextStates, getInvoiceStatusText } from "../components/invoices/invoice-status-utils.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("rectified invoice status has a localized label in the detail", () => {
    const labels = {
        status_draft: "Borrador",
        status_issued: "Emitida",
        status_partially_paid: "Parcialmente cobrada",
        status_paid: "Pagada",
        status_overdue: "Vencida",
        status_cancelled: "Anulada",
        status_rectified: "Rectificada",
    };
    assert.equal(getInvoiceStatusText("rectified", labels), "Rectificada");
    assert.match(read("../components/invoices/invoice-detail-utils.ts"), /status === "rectified"/);
});

test("rectification banner identifies its original without calling it rectified by the original", () => {
    const banner = read("../components/invoices/InvoiceDetailRectificationBanner.tsx");
    assert.match(banner, /rectification_original_label/);
    assert.doesNotMatch(banner, /rectified_by/);
});

test("invoice payment section displays the collectible balance, not historical face value", () => {
    const section = read("../components/invoices/CustomerPaymentSection.tsx");
    assert.match(section, /getCollectibleRemaining\(invoice, allocated\)/);
});

test("a credit note has no overdue action, while a normal issued invoice keeps it", () => {
    assert.deepEqual(getInvoiceNextStates({ status: "issued", is_rectification: true }), []);
    assert.deepEqual(getInvoiceNextStates({ status: "issued", is_rectification: false }), ["overdue"]);
    assert.deepEqual(getInvoiceNextStates({ status: "draft", is_rectification: false }), ["issued", "cancelled"]);
    assert.match(read("../hooks/useInvoiceDetail.ts"), /getInvoiceNextStates\(invoice\)/);
});
