import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layout = readFileSync(
    new URL("../app/dashboard/layout.tsx", import.meta.url),
    "utf8",
);
const account = readFileSync(
    new URL("../components/dashboard/NoWorkspaceAccount.tsx", import.meta.url),
    "utf8",
);

test("a person without a company gets an account-only workspace", () => {
    assert.match(layout, /user\.company_id == null && user\.role\?\.name !== "superadmin"/);
    assert.match(layout, /<NoWorkspaceAccount/);
    assert.match(account, /PrivacyControls/);
    assert.match(account, /@\/components\/ui\/button/);
    assert.doesNotMatch(account, /<button/);
});
