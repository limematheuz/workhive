import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("profile identity, privacy, and stats use billing surfaces without touching histories tables", () => {
    const page = source("../app/dashboard/profile/page.tsx");
    const privacy = source("../components/profile/PrivacyControls.tsx");
    const stats = source("../components/profile/ProfileStats.tsx");
    const histories = source("../components/profile/ProfileHistories.tsx");
    const details = source("../components/profile/ProfileDetailsForm.tsx");
    const globals = source("../app/globals.css");

    assert.match(page, /billing-surface/);
    assert.match(page, /billing-surface-accent-pad/);
    assert.match(page, /rounded-full bg-accent/);
    assert.match(page, /from "@\/components\/ui\/badge"/);
    assert.match(page, /from "@\/components\/ui\/button"/);
    assert.match(page, /ProfileHistories/);
    assert.match(page, /btn-cancel-muted/);
    assert.match(page, /Cerrar Editor|Close Editor/);

    assert.match(privacy, /billing-surface/);
    assert.match(privacy, /rounded-full bg-accent/);
    assert.match(privacy, /PAGE_ACTION_BUTTON_PRIMARY/);
    assert.match(privacy, /billing-block/);

    assert.match(stats, /billing-block/);
    assert.match(stats, /rounded-\[18px\]/);
    assert.doesNotMatch(stats, /shadow-xl|bg-\[var\(--bg-card\)\] border border-\[var\(--border-soft\)\]/);

    assert.match(details, /btn-cancel-muted/);
    assert.match(details, /PAGE_ACTION_BUTTON_PRIMARY/);
    assert.match(globals, /\.btn-cancel-muted/);
    assert.match(globals, /var\(--bg-tertiary\)/);
    // Histories / tables stay on the shared DataListTable path — leave table markup alone.
    assert.match(histories, /DataListTable/);
    assert.match(histories, /variant="plain"/);
    assert.doesNotMatch(histories, /<table className="w-full text-left border-collapse">/);
});
