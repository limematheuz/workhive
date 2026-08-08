import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("collaborations page uses billing surfaces and preserves unlink cancel dialog", () => {
    const page = source("../app/dashboard/collaborations/page.tsx");
    const partnerCode = source("../components/collaborations/CollaborationPartnerCodeCard.tsx");
    const connect = source("../components/collaborations/CollaborationConnectForm.tsx");
    const requests = source("../components/collaborations/CollaborationRequestsPanel.tsx");
    const active = source("../components/collaborations/ActiveCollaboratorsPanel.tsx");

    assert.match(page, /billing-surface/);
    assert.match(page, /billing-surface-accent-pad/);
    assert.match(page, /rounded-full bg-accent/);
    assert.match(page, /PageHeader/);
    assert.match(page, /DeleteConfirmDialog/);
    assert.match(page, /cancelText="Cancelar"/);
    assert.doesNotMatch(page, /btn-cancel-muted/);
    assert.doesNotMatch(page, /surface-glass-card/);

    assert.match(partnerCode, /billing-block/);
    assert.match(partnerCode, /from "@\/components\/ui\/button"/);
    assert.doesNotMatch(partnerCode, /surface-glass-card/);

    assert.match(connect, /billing-block/);
    assert.match(connect, /from "@\/components\/ui\/input"/);
    assert.match(connect, /from "@\/components\/ui\/label"/);
    assert.match(connect, /DocumentFormSelect/);
    assert.match(connect, /PAGE_ACTION_BUTTON_PRIMARY/);
    assert.doesNotMatch(connect, /surface-glass-card/);

    assert.match(requests, /billing-surface/);
    assert.match(requests, /billing-block/);
    assert.match(requests, /from "@\/components\/ui\/badge"/);
    assert.match(requests, /variant="dangerSoft"/);

    assert.match(active, /billing-surface/);
    assert.match(active, /billing-block/);
    assert.match(active, /from "@\/components\/ui\/badge"/);
    assert.match(active, /variant="dangerSoft"/);
    assert.doesNotMatch(active, /min-h-\[170px\]/);
    assert.doesNotMatch(active, /btn-cancel-muted/);
});
