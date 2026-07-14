import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
    new URL("../components/invoices/InvoicesStatsCards.tsx", import.meta.url),
    "utf8",
);

test("invoice stats cards use a 2x2 grid on mobile", () => {
    assert.match(source, /grid grid-cols-2 gap-3 xl:grid-cols-4/);
    assert.doesNotMatch(source, /md:grid-cols-2/);
});

test("invoice stats cards use a left accent instead of a decorative top bar", () => {
    assert.match(source, /border-l-4/);
    assert.doesNotMatch(source, /h-1\.5 w-20 rounded-full/);
});
