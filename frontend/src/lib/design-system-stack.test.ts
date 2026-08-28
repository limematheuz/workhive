import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("the interface uses local shadcn-style primitives and no competing component suite", () => {
    const packageJson = source("../../package.json");
    const button = source("../components/ui/button.tsx");

    assert.match(packageJson, /"radix-ui"/);
    assert.match(button, /from "radix-ui"/);

    for (const competingSuite of [
        "@mui/material",
        "@material-ui",
        "antd",
        "bootstrap",
        "@chakra-ui",
        "@mantine",
        "primereact",
    ]) {
        assert.doesNotMatch(packageJson, new RegExp(competingSuite.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
});

test("the document workspace uses semantic action variants without altering global surfaces", () => {
    const globals = source("../app/globals.css");
    const button = source("../components/ui/button.tsx");
    const buttonVariants = source("../components/ui/button-variants.ts");
    const invoiceActionBar = source("../components/invoices/InvoiceDetailActionBar.tsx");
    const invoiceItems = source("../components/invoices/InvoiceDetailItemsSection.tsx");
    const invoiceNotice = source("../components/invoices/InvoiceNoticeCard.tsx");
    const invoiceList = source("../components/invoices/InvoicesListSection.tsx");
    const invoiceActions = source("../components/invoices/invoice-detail-utils.ts");

    assert.match(globals, /--btn-select-bg/);
    assert.match(globals, /\.billing-surface/);
    assert.match(globals, /\.billing-block/);
    assert.doesNotMatch(globals, /\.billing-workspace/);
    assert.match(globals, /background-color: rgba\(213, 224, 231, 0\.54\)/);
    assert.match(globals, /\.billing-surface\s*\{\s*background-color: var\(--surface-card-bg\);\s*box-shadow:/);
    assert.match(globals, /\.billing-block\s*\{\s*background-color: var\(--bg-tertiary\);/);
    assert.doesNotMatch(globals, /--bg-primary: #f4f6f8/);
    assert.match(button, /button-variants/);
    assert.match(buttonVariants, /select:/);
    assert.match(buttonVariants, /dangerSoft:/);
    assert.match(invoiceActions, /tone === "neutral".*backdrop-blur-xl/);
    assert.match(invoiceActionBar, /bg-\[var\(--bg-tertiary\)\]/);
    assert.doesNotMatch(invoiceActionBar, /ArrowLeft|next\/link/);
    assert.match(invoiceItems, /bg-\[color-mix\(in_srgb,var\(--accent-color\)_16%,var\(--bg-secondary\)\)\]/);
    assert.match(invoiceItems, /border-l-2 border-\[var\(--accent-color\)\]/);
    assert.match(invoiceNotice, /tone === "warning" && "bg-\[color-mix/);
    assert.match(invoiceNotice, /var\(--bg-tertiary\)/);
    assert.match(invoiceList, /Facturas registradas/);
    assert.match(invoiceList, /from "@\/components\/ui\/table"/);
    assert.match(invoiceList, /<TableHeader>/);
    assert.match(invoiceList, /<TableBody>/);
    assert.doesNotMatch(invoiceList, /DataListTable/);
});
