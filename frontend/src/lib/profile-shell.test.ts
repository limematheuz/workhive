import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("profile identity, privacy, and stats use billing surfaces without touching histories tables", () => {
    const page = source("../app/dashboard/profile/page.tsx");
    const privacy = source("../components/profile/PrivacyControls.tsx");
    const privacyManagement = source("../components/profile/PrivacyRequestManagement.tsx");
    const privacyUi = `${privacy}\n${privacyManagement}`;
    const stats = source("../components/profile/ProfileStats.tsx");
    const histories = source("../components/profile/ProfileHistories.tsx");
    const details = source("../components/profile/ProfileDetailsForm.tsx");
    const company = source("../components/profile/CompanyDetailsFormFields.tsx");
    const password = source("../components/profile/PasswordChangeForm.tsx");
    const email = source("../components/profile/EmailChangeForm.tsx");
    const section = source("../components/profile/ProfileFormSection.tsx");
    const globals = source("../app/globals.css");

    assert.match(page, /billing-surface/);
    assert.match(page, /billing-surface-accent-pad/);
    assert.match(page, /rounded-full bg-accent/);
    assert.match(page, /from "@\/components\/ui\/badge"/);
    assert.match(page, /from "@\/components\/ui\/button"/);
    assert.match(page, /ProfileHistories/);
    assert.match(page, /btn-cancel-muted/);
    assert.match(page, /Cerrar Editor|Close Editor/);

    assert.match(privacyUi, /billing-surface/);
    assert.match(privacyUi, /rounded-full bg-accent/);
    assert.match(privacyUi, /PAGE_ACTION_BUTTON_PRIMARY/);
    assert.match(privacyUi, /billing-block/);

    assert.match(stats, /billing-block/);
    assert.match(stats, /rounded-\[18px\]/);
    assert.doesNotMatch(stats, /shadow-xl|bg-\[var\(--bg-card\)\] border border-\[var\(--border-soft\)\]/);

    assert.match(section, /billing-block/);
    assert.match(details, /DocumentFormField/);
    assert.match(details, /DocumentFormInput/);
    assert.match(details, /ProfileFormSection/);
    assert.match(details, /btn-cancel-muted/);
    assert.match(details, /PAGE_ACTION_BUTTON_PRIMARY/);
    assert.match(company, /DocumentFormField/);
    assert.match(company, /company-swift-bic/);
    assert.match(company, /btn-cancel-muted/);
    assert.match(password, /DocumentFormField/);
    assert.match(password, /btn-cancel-muted/);
    assert.match(email, /DocumentFormField/);
    assert.match(email, /PAGE_ACTION_BUTTON_PRIMARY/);
    assert.match(globals, /\.btn-cancel-muted/);
    assert.match(globals, /var\(--bg-tertiary\)/);
    // Histories / tables stay on the shared DataListTable path — leave table markup alone.
    assert.match(histories, /DataListTable/);
    assert.match(histories, /variant="plain"/);
    assert.doesNotMatch(histories, /<table className="w-full text-left border-collapse">/);
});
