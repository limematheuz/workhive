import assert from "node:assert/strict";
import test from "node:test";
import { canViewCompanyPlanSummary, displayPlanCode, formatCompanyPlanLimit, formatCompanyPlanTrialEnd, visibleCompanyPlanEntitlements } from "./company-plan-summary.ts";
import type { Entitlement } from "../services/company-plan-access.service.ts";

test("current and legacy company plans have stable display codes", () => {
    assert.equal(displayPlanCode("trial"), "top");
    assert.equal(displayPlanCode("pro"), "top");
    assert.equal(displayPlanCode("free"), "basic");
    assert.equal(displayPlanCode("medium"), "medium");
    assert.equal(displayPlanCode("custom"), "custom");
    assert.equal(displayPlanCode("none"), null);
});

test("plan summary is visible only to a tenant administrator", () => {
    assert.equal(canViewCompanyPlanSummary({ company_id: 1, role: { name: "admin" } }), true);
    assert.equal(canViewCompanyPlanSummary({ company_id: 1, role: { name: "manager" } }), false);
    assert.equal(canViewCompanyPlanSummary({ company_id: 1, role: { name: "viewer" } }), false);
    assert.equal(canViewCompanyPlanSummary({ company_id: null, role: { name: "admin" } }), false);
    assert.equal(canViewCompanyPlanSummary({ company_id: 1, role: { name: "superadmin" } }), false);
    assert.equal(canViewCompanyPlanSummary(null), false);
});

test("tenant plan summary excludes unavailable and platform-only capabilities", () => {
    const entitlement = (code: string, group: Entitlement["group"], value: boolean | number, availability: Entitlement["availability"]): Entitlement => ({
        code,
        group,
        value,
        availability,
        label: code,
        value_type: typeof value === "boolean" ? "boolean" : "integer",
        source: "plan",
    });
    const result = visibleCompanyPlanEntitlements([
        entitlement("features.tasks", "Funciones", true, "available"),
        entitlement("features.disabled", "Funciones", false, "available"),
        entitlement("features.future", "Funciones", true, "coming_soon"),
        entitlement("features.platform", "Funciones", true, "platform_internal"),
        entitlement("limits.teams", "Capacidad", 2, "available"),
        entitlement("limits.workers", "Capacidad", 0, "available"),
        entitlement("limits.internal_admins", "Capacidad", 1, "available"),
        entitlement("limits.future", "Capacidad", 10, "coming_soon"),
    ]);

    assert.deepEqual(result.features.map((item) => item.code), ["features.tasks"]);
    assert.deepEqual(result.limits.map((item) => [item.code, item.value]), [
        ["limits.internal_admins", 1], ["limits.teams", 2], ["limits.workers", 0],
    ]);
});

test("plan capacity shows document size in MB and localizes ordinary counts", () => {
    assert.equal(formatCompanyPlanLimit("limits.location_document_storage_bytes", 10 * 1024 * 1024, "es"), "10 MB");
    assert.equal(formatCompanyPlanLimit("limits.internal_workers", 1000, "es"), "1000");
    assert.equal(formatCompanyPlanLimit("limits.internal_workers", 1000, "en"), "1,000");
});

test("trial expiration displays its contractual calendar day, not the next Madrid day", () => {
    assert.equal(formatCompanyPlanTrialEnd("2026-10-24T23:59:59Z", "es"), "24 oct 2026");
    assert.equal(formatCompanyPlanTrialEnd("2026-10-24T23:59:59Z", "en"), "24 Oct 2026");
    assert.equal(formatCompanyPlanTrialEnd(null, "es"), null);
});
