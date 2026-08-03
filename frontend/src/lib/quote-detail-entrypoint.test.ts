import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const list = readFileSync(
    new URL("../components/quotes/QuotesListSection.tsx", import.meta.url),
    "utf8",
);
const sheet = readFileSync(
    new URL("../components/quotes/QuoteDetailSheet.tsx", import.meta.url),
    "utf8",
);
const legacyDetail = readFileSync(
    new URL("../app/dashboard/quotes/[id]/page.tsx", import.meta.url),
    "utf8",
);
const quotesPage = readFileSync(
    new URL("../app/dashboard/quotes/page.tsx", import.meta.url),
    "utf8",
);

test("all quote detail entry points use the shared detail sheet", () => {
    assert.doesNotMatch(list, /href=\{`\/dashboard\/quotes\/\$\{quote\.id\}/);
    assert.match(list, /onClick: \(\) => onViewQuote\(quote\)/);
    assert.match(list, /onClick: \(\) => onEditQuote\(quote\)/);
    assert.match(sheet, /onEditQuote\(quote\)/);
    assert.match(legacyDetail, /\/dashboard\/quotes\?quote=/);
    assert.match(quotesPage, /<Suspense fallback=\{<QuotesPageLoading \/>\}>/);
});
