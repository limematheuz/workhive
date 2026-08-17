import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("sales ledger service uses the dedicated manual-record boundary", () => {
    const service = read("../services/sales-ledger.service.ts");

    assert.match(service, /\/api\/v1\/sales-ledger\//);
    assert.match(service, /\/manual-records/);
    assert.match(service, /\/import\/preview/);
    assert.match(service, /assertApiResponseOk/);
    assert.doesNotMatch(service, /InvoiceService|\/api\/v1\/invoices/);
});

test("manual ledger dialogs validate CSV before importing and keep deletion explicit", () => {
    const recordDialog = read("../components/invoices/SalesLedgerRecordDialog.tsx");
    const importDialog = read("../components/invoices/SalesLedgerImportDialog.tsx");

    assert.match(recordDialog, /parseMoneyInput/);
    assert.match(recordDialog, /DeleteConfirmDialog/);
    assert.match(importDialog, /onPreview/);
    assert.match(importDialog, /preview\.errors\.length > 0/);
    assert.match(importDialog, /accept="\.csv,text\/csv"/);
});
