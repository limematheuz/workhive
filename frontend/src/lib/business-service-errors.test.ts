import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceSources = [
    "../services/company.service.ts",
    "../services/invoice.service.ts",
    "../services/quote.service.ts",
    "../services/collaboration.service.ts",
    "../services/task.service.ts",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

test("business read services use centralized safe response errors", () => {
    for (const source of serviceSources) {
        assert.match(source, /assertApiResponseOk/);
    }
    assert.doesNotMatch(
        serviceSources.join("\n"),
        /if \(!response\.ok\)\s*(?:\{\s*)?throw new Error\([^)]*fetching/,
    );
});

test("invoice and company services cover the failing analytics and profile reads", () => {
    const invoiceSource = serviceSources[1];
    const companySource = serviceSources[0];
    assert.match(invoiceSource, /getInvoices/);
    assert.match(invoiceSource, /assertApiResponseOk\(response,\s*"Error fetching invoices"\)/);
    assert.match(companySource, /getCompany/);
    assert.match(companySource, /assertApiResponseOk\(response,\s*"No se ha podido cargar la empresa"\)/);
    assert.match(companySource, /No se han podido cargar las personas de la empresa/);
});

test("task service covers rejected-status reads used by notifications", () => {
    const taskSource = serviceSources[4];
    assert.match(taskSource, /task_status/);
    assert.match(taskSource, /assertApiResponseOk\(response,\s*"Error fetching task items"\)/);
});
