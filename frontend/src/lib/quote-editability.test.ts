import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isQuoteContentEditable } from "./quote-editability.ts";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("isQuoteContentEditable allows only drafts; sent documents require a revision", () => {
    assert.equal(isQuoteContentEditable("draft"), true);
    assert.equal(isQuoteContentEditable("sent"), false);
    assert.equal(isQuoteContentEditable("accepted"), false);
    assert.equal(isQuoteContentEditable("rejected"), false);
    assert.equal(isQuoteContentEditable("expired"), false);
});

test("quote edit entry points use shared content-editability rule", () => {
    const list = source("../components/quotes/QuotesListSection.tsx");
    const actions = source("../components/quotes/QuoteDetailActions.tsx");
    const detailSheet = source("../components/quotes/QuoteDetailSheet.tsx");
    const quoteService = source("../services/quote.service.ts");
    const detailHook = source("../hooks/useQuoteDetail.ts");
    const backend = readFileSync(
        new URL("../../../backend/app/services/quote_service.py", import.meta.url),
        "utf8",
    );
    const quotePolicy = readFileSync(
        new URL("../../../backend/app/services/quote_policy_service.py", import.meta.url),
        "utf8",
    );

    assert.match(list, /isQuoteContentEditable\(quote\.status\)/);
    assert.doesNotMatch(actions, /isQuoteContentEditable|edit_quote|onEdit/);
    assert.match(detailHook, /isQuoteContentEditable\(quote\.status\)/);
    assert.match(quotePolicy, /CONTENT_EDITABLE_STATUSES = frozenset\(\{"draft"\}\)/);
    assert.match(quotePolicy, /assert_quote_content_editable/);
    assert.match(actions, /Crear revisión/);
    assert.match(actions, /Historial/);
    assert.match(detailSheet, /createQuoteRevision/);
    assert.match(detailSheet, /getQuoteRevisions/);
    assert.match(quoteService, /\/revisions/);
    assert.doesNotMatch(backend, /Cannot replace items of a non-draft quote/);
});
