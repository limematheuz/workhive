import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serviceSources = [
    "../services/company.service.ts",
    "../services/invoice.service.ts",
    "../services/quote.service.ts",
    "../services/collaboration.service.ts",
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
