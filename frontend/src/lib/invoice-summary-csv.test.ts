import assert from "node:assert/strict";
import test from "node:test";

import { buildInvoiceSummaryCsv, INVOICE_SUMMARY_CSV_TEMPLATE } from "./invoice-summary-csv.ts";
import type { Invoice } from "@/types/invoice";

test("invoice ledger CSV uses the compact Spanish headers and escapes client names", () => {
    const csv = buildInvoiceSummaryCsv([{
        clientName: "Bosch, S.L.",
        invoice: {
            invoice_number: "INV-2026-0001", issue_date: "2026-01-05T12:00:00Z", total_amount: 121, base_amount: 100, tax_amount: 21, status: "paid",
        },
    }] as Array<{ invoice: Invoice; clientName: string }>);

    assert.match(csv, /^N Factura;Fecha;Cliente;Importe Total;Base;IVA;Cobrada/m);
    assert.match(csv, /"Bosch, S\.L\."/);
});

test("invoice ledger exposes an exact seven-column CSV template without importing invoices", () => {
    assert.equal(
        INVOICE_SUMMARY_CSV_TEMPLATE,
        "N Factura;Fecha;Cliente;Importe Total;Base;IVA;Cobrada\nFV/2026/0001;05/01/2026;Nombre del cliente;121,00;100,00;21,00;Pagada",
    );
});
