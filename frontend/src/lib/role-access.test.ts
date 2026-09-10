import assert from "node:assert/strict";
import test from "node:test";

import {
    canManageFinance,
    canManageWorkReports,
    canViewFinance,
    canViewFinanceRole,
    canViewWorkReports,
    isCompanyAdminRole,
    isExternalPortalRole,
    isPartnerPortalRole,
} from "../domain/access/roles.ts";
import type { User } from "../types/user.ts";

const commercialWithoutFinance = {
    id: 81,
    company_id: 44,
    role_id: 3,
    email: "commercial@workhive.example",
    full_name: "Comercial",
    is_active: true,
    role: { id: 3, name: "admin" },
    can_view_finance: false,
    can_manage_finance: false,
} satisfies User;

test("company privacy administration excludes managers and viewers", () => {
    assert.equal(isCompanyAdminRole("admin"), true);
    assert.equal(isCompanyAdminRole("superadmin"), true);
    assert.equal(isCompanyAdminRole("manager"), false);
    assert.equal(isCompanyAdminRole("viewer"), false);
});

test("sponsored partner portals are neither finance nor company roles", () => {
    assert.equal(isPartnerPortalRole("partner_portal"), true);
    assert.equal(isCompanyAdminRole("partner_portal"), false);
    assert.equal(canViewFinanceRole("partner_portal"), false);
});

test("external accountants can read finance without becoming company administrators", () => {
    assert.equal(isExternalPortalRole("external_portal"), true);
    assert.equal(isCompanyAdminRole("external_portal"), false);
    assert.equal(canViewFinanceRole("external_portal"), true);
    assert.equal(canViewFinanceRole("viewer"), false);
});

test("explicit company capabilities override a legacy role for financial UI", () => {
    assert.equal(canViewFinance(commercialWithoutFinance), false);
    assert.equal(canManageFinance(commercialWithoutFinance), false);
});

test("explicit work-report capabilities control report visibility and mutations", () => {
    const reader = {
        ...commercialWithoutFinance,
        can_view_work_reports: true,
        can_manage_work_reports: false,
    } satisfies User;
    const manager = {
        ...reader,
        can_manage_work_reports: true,
    } satisfies User;

    assert.equal(canViewWorkReports(reader), true);
    assert.equal(canManageWorkReports(reader), false);
    assert.equal(canManageWorkReports(manager), true);
});
