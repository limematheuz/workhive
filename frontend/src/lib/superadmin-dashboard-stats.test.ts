import assert from "node:assert/strict";
import test from "node:test";

import {
    buildSuperadminDashboardStats,
    countPendingTrialRequests,
    isTrialCompany,
    pendingTrialRequestsPreview,
    recentCompaniesPreview,
} from "./superadmin-dashboard-stats.ts";
import type { Company } from "../types/company.ts";
import type { TrialRequest } from "../services/trial-request.service.ts";

function company(partial: Partial<Company> & Pick<Company, "id" | "name">): Company {
    return {
        is_active: true,
        subscription_plan: "pro",
        subscription_status: "active",
        ...partial,
    };
}

function trialRequest(
    partial: Partial<TrialRequest> & Pick<TrialRequest, "id" | "status" | "created_at">,
): TrialRequest {
    return {
        full_name: "Ada",
        email: "ada@example.com",
        company_name: "Ada Co",
        updated_at: partial.created_at,
        ...partial,
    };
}

test("isTrialCompany detects trial plan and trialing status", () => {
    assert.equal(isTrialCompany(company({ id: 1, name: "A", subscription_plan: "trial" })), true);
    assert.equal(
        isTrialCompany(company({ id: 2, name: "B", subscription_status: "trialing" })),
        true,
    );
    assert.equal(isTrialCompany(company({ id: 3, name: "C" })), false);
});

test("buildSuperadminDashboardStats aggregates real list counts", () => {
    const stats = buildSuperadminDashboardStats({
        companies: [
            company({ id: 1, name: "Active Co" }),
            company({
                id: 2,
                name: "Trial Co",
                subscription_plan: "trial",
                subscription_status: "trialing",
            }),
            company({
                id: 3,
                name: "Off Co",
                is_active: false,
                subscription_status: "inactive",
            }),
        ],
        users: [{ id: 1 }, { id: 2 }, { id: 3 }],
        roles: [{ id: 10 }, { id: 11 }],
        trialRequests: [
            trialRequest({ id: 1, status: "email_verified", created_at: "2026-08-01T10:00:00Z" }),
            trialRequest({ id: 2, status: "approved", created_at: "2026-08-02T10:00:00Z" }),
            trialRequest({
                id: 3,
                status: "pending_email_verification",
                created_at: "2026-08-03T10:00:00Z",
            }),
        ],
    });

    assert.deepEqual(stats, {
        companies: 3,
        activeCompanies: 2,
        trialCompanies: 1,
        teamMembers: 3,
        roles: 2,
        pendingTrialRequests: 1,
    });
});

test("pending previews keep only email_verified and newest first", () => {
    assert.equal(
        countPendingTrialRequests([
            trialRequest({ id: 1, status: "email_verified", created_at: "2026-08-01T10:00:00Z" }),
            trialRequest({ id: 2, status: "approved", created_at: "2026-08-02T10:00:00Z" }),
        ]),
        1,
    );

    const preview = pendingTrialRequestsPreview(
        [
            trialRequest({ id: 1, status: "email_verified", created_at: "2026-08-01T10:00:00Z" }),
            trialRequest({ id: 2, status: "email_verified", created_at: "2026-08-05T10:00:00Z" }),
            trialRequest({ id: 3, status: "rejected", created_at: "2026-08-06T10:00:00Z" }),
        ],
        1,
    );

    assert.equal(preview.length, 1);
    assert.equal(preview[0]?.id, 2);
});

test("recentCompaniesPreview sorts by name and respects limit", () => {
    const preview = recentCompaniesPreview(
        [
            company({ id: 1, name: "Zeta" }),
            company({ id: 2, name: "Alpha" }),
            company({ id: 3, name: "Beta" }),
        ],
        2,
    );

    assert.deepEqual(
        preview.map((item) => item.name),
        ["Alpha", "Beta"],
    );
});
