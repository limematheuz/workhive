import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("invoice detail distinguishes a denied or missing invoice from a load failure", () => {
    const hook = read("../hooks/useInvoiceDetail.ts");
    const view = read("../components/invoices/InvoiceDetailView.tsx");
    const spanish = JSON.parse(read("../dictionaries/es.json"));
    const english = JSON.parse(read("../dictionaries/en.json"));

    assert.match(hook, /error instanceof ApiResponseError && error\.status === 404/);
    assert.match(hook, /setLoadError\("not_found"\)/);
    assert.match(hook, /setLoadError\("failed"\)/);
    assert.match(hook, /error instanceof ApiResponseError && error\.status === 404\) \{\s+setInvoice\(null\)/);
    assert.doesNotMatch(hook, /toast\.error\(dict\.invoices\.error_load\)/);
    assert.match(view, /loadError === "not_found" \? dict\.invoices\.not_found : dict\.invoices\.load_failed/);
    assert.match(view, /loadError === "failed" && <Button[^>]+onClick=\{\(\) => void loadAllData\(\)\}/);
    for (const dictionary of [spanish, english]) {
        assert.ok(dictionary.invoices.not_found);
        assert.ok(dictionary.invoices.load_failed);
        assert.ok(dictionary.invoices.retry_load);
    }
});
