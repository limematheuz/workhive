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
    const workspace = source("../components/invoices/use-invoices-workspace.ts");
    const page = source("../app/dashboard/invoices/page.tsx");
    const utils = source("../components/invoices/invoice-detail-utils.ts");

    assert.doesNotMatch(actionBar, /edit_draft|onEnterEditMode|Pencil/);
    assert.match(actionBar, /actionButtonClass\(invoice\.status === \"draft\" \? \"select\" : \"neutral\"\)/);
    assert.match(utils, /btn-neutral-bg/);
    assert.match(utils, /tone === \"select\"/);
    assert.match(list, /getInvoiceActions/);
    assert.match(list, /onOpenInvoice\(invoice\.id\)/);
    assert.match(list, /onOpenInvoice\(invoice\.id, "edit"\)/);
    assert.match(workspace, /selectedInvoiceIntent/);
    assert.match(page, /initialEdit=\{selectedInvoiceIntent === "edit"\}/);
    assert.match(detailHook, /initialEditPendingRef/);
    assert.doesNotMatch(list, /\?edit=true/);
    assert.match(detailHook, /openEditFromQueryEvent/);
    assert.match(detailHook, /queryParams\.get\(\"edit\"\) === \"true\"/);
});
