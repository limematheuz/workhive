import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("contracts page avoids false empty states on read failures and preserves deep-link retry", () => {
    const page = readFileSync(
        new URL("../app/dashboard/contracts/page.tsx", import.meta.url),
        "utf8",
    );

    assert.match(page, /const \[loadError, setLoadError\] = React\.useState<string \| null>\(null\)/);
    assert.match(page, /setLoadError\(null\)/);
    assert.match(page, /setContracts\(\[\]\)\s*\n\s*setLoadError\(message\)/);
    assert.match(page, /if \(loading \|\| loadError \|\| !Number\.isSafeInteger\(sourceQuoteId\)/);
    assert.match(page, /empty=\{loadError \? \(/);
    assert.match(page, /Reintentar/);
});

test("ServiceContractService routes all endpoints through assertApiResponseOk", () => {
    const service = readFileSync(
        new URL("../services/service-contract.service.ts", import.meta.url),
        "utf8",
    );

    const assertCalls = service.match(/assertApiResponseOk\(/g) ?? [];
    assert.equal(
        assertCalls.length,
        9,
        `Expected all 9 ServiceContractService endpoints to use assertApiResponseOk, found ${assertCalls.length}`,
    );
});
