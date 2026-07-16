import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getCompanyContactEmail } from "../components/companies/company-utils.ts";
import { isPlatformSuperadmin } from "../domain/access/roles.ts";


test("company list contact uses the active admin instead of the fiscal email", () => {
    const company = {
        id: 1,
        name: "Tester",
        email: "mribeiro17.info@gmail.com",
        contact_email: "tester@workhive.com",
        is_active: true,
    };

    assert.equal(getCompanyContactEmail(company), "tester@workhive.com");
});


test("company list does not fall back to a potentially private fiscal email", () => {
    const company = {
        id: 1,
        name: "Tester",
        email: "mribeiro17.info@gmail.com",
        contact_email: null,
        is_active: true,
    };

    assert.equal(getCompanyContactEmail(company), null);
});


test("global company panel requires a platform superadmin", () => {
    assert.equal(isPlatformSuperadmin({
        id: 1,
        email: "platform@example.com",
        role_id: 4,
        role: { id: 4, name: "superadmin", is_active: true },
        company_id: null,
    }), true);
    assert.equal(isPlatformSuperadmin({
        id: 2,
        email: "scoped@example.com",
        role_id: 4,
        role: { id: 4, name: "superadmin", is_active: true },
        company_id: 10,
    }), false);
});


test("companies UI renders contact_email and uses platform scope checks", () => {
    const list = readFileSync(
        new URL("../components/companies/CompaniesListSection.tsx", import.meta.url),
        "utf8",
    );
    const page = readFileSync(
        new URL("../app/dashboard/companies/page.tsx", import.meta.url),
        "utf8",
    );
    const requests = readFileSync(
        new URL("../components/companies/TrialRequestsPanel.tsx", import.meta.url),
        "utf8",
    );
    const roles = readFileSync(
        new URL("../app/dashboard/roles/page.tsx", import.meta.url),
        "utf8",
    );
    const traffic = readFileSync(
        new URL("../app/dashboard/traffic/page.tsx", import.meta.url),
        "utf8",
    );
    const sidebar = readFileSync(
        new URL("../components/dashboard/sidebar-nav-config.tsx", import.meta.url),
        "utf8",
    );

    assert.match(list, /getCompanyContactEmail\(company\)/);
    assert.doesNotMatch(list, /\{company\.email \|\| ["']—["']\}/);
    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(requests, /isPlatformSuperadmin\(user\)/);
    assert.match(roles, /isPlatformSuperadmin\(user\)/);
    assert.match(traffic, /isPlatformSuperadmin\(currentUser\)/);
    assert.match(sidebar, /userIsPlatformSuperadmin/);
    assert.doesNotMatch(sidebar, /userIsSuperadmin/);
});
