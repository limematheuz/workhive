import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml, escapeHtmlWithLineBreaks } from "./html.ts";

test("escapeHtml neutralizes markup and attribute delimiters", () => {
    assert.equal(
        escapeHtml(`<img src=x onerror="alert('xss')">`),
        "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;"
    );
});

test("escapeHtmlWithLineBreaks preserves plain-text line breaks", () => {
    assert.equal(
        escapeHtmlWithLineBreaks("First line\n<script>alert(1)</script>"),
        "First line<br/>&lt;script&gt;alert(1)&lt;/script&gt;"
    );
});
