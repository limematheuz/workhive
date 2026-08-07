import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("invoice detail keeps edit out of the action bar and opens it from the list", () => {
    const actionBar = source("../components/invoices/InvoiceDetailActionBar.tsx");
    const list = source("../components/invoices/InvoicesListSection.tsx");
    const detailHook = source("../hooks/useInvoiceDetail.ts");
    const utils = source("../components/invoices/invoice-detail-utils.ts");

    assert.doesNotMatch(actionBar, /edit_draft|onEnterEditMode|Pencil/);
    assert.match(actionBar, /actionButtonClass\(invoice\.status === \"draft\" \? \"select\" : \"neutral\"\)/);
    assert.match(utils, /btn-neutral-bg/);
    assert.match(utils, /tone === \"select\"/);
    assert.match(list, /getInvoiceActions/);
    assert.match(list, /onOpenInvoice\(invoice\.id\)/);
    assert.doesNotMatch(list, /\?edit=true/);
    assert.match(detailHook, /openEditFromQueryEvent/);
    assert.match(detailHook, /edit\"\) !== \"true\"/);
});
