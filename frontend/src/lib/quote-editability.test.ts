import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isQuoteContentEditable } from "./quote-editability.ts";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("isQuoteContentEditable allows draft and sent after email", () => {
    assert.equal(isQuoteContentEditable("draft"), true);
    assert.equal(isQuoteContentEditable("sent"), true);
    assert.equal(isQuoteContentEditable("accepted"), false);
    assert.equal(isQuoteContentEditable("rejected"), false);
    assert.equal(isQuoteContentEditable("expired"), false);
});

test("quote edit entry points use shared content-editability rule", () => {
    const list = source("../components/quotes/QuotesListSection.tsx");
    const actions = source("../components/quotes/QuoteDetailActions.tsx");
    const detailHook = source("../hooks/useQuoteDetail.ts");
    const backend = readFileSync(
        new URL("../../../backend/app/services/quote_service.py", import.meta.url),
        "utf8",
    );

    assert.match(list, /isQuoteContentEditable\(quote\.status\)/);
    assert.doesNotMatch(actions, /isQuoteContentEditable|edit_quote|onEdit/);
    assert.match(detailHook, /isQuoteContentEditable\(quote\.status\)/);
    assert.match(backend, /CONTENT_EDITABLE_STATUSES = frozenset\(\{"draft", "sent"\}\)/);
    assert.match(backend, /_assert_quote_content_editable/);
    assert.doesNotMatch(backend, /Cannot replace items of a non-draft quote/);
});
