import assert from "node:assert/strict";
import test from "node:test";
import {
    APPLICATION_DESTINATIONS, isCurrentApplication, readApplicationAccess,
    readApplicationWorkspace, resolveApplicationSwitchTarget,
    type ApplicationAccess, type ApplicationAccessKind,
} from "./application-access.ts";

const application = (kind: ApplicationAccessKind, company = 1, key = `${kind}:${company}`): ApplicationAccess => ({
    key, kind, label: kind, description: "Acceso autorizado", company_id: company,
    company_name: "Empresa de prueba", href: APPLICATION_DESTINATIONS[kind],
});

test("the selector preserves only server-listed grants and identifies the exact active company or client", () => {
    const first = application("client", 1, "client:7"), second = application("client", 1, "client:9");
    const workspace = readApplicationWorkspace({ current_application: "client", current_key: second.key, applications: [first, second] });
    assert.equal(workspace.applications.length, 2);
    assert.equal(isCurrentApplication(workspace, first), false);
    assert.equal(isCurrentApplication(workspace, second), true);
    assert.equal(workspace.applications.some(row => row.kind === "internal"), false);
    assert.equal(isCurrentApplication({ ...workspace, current_key: null }, first), false);
});

test("invalid, duplicate and off-site access records fail closed before being offered as navigation", () => {
    const valid = application("internal");
    for (const patch of [{ kind: "superadmin" }, { company_id: null }, { company_id: -1 }, { company_id: "1" }, { key: "" }, { href: "//outside.example" }, { href: "/dashboard?next=https://outside.example" }, { href: "javascript:alert(1)" }]) {
        assert.throws(() => readApplicationAccess({ ...valid, ...patch }));
    }
    assert.throws(() => readApplicationWorkspace({ current_application: "internal", applications: [valid, valid] }));
    assert.throws(() => readApplicationWorkspace({ current_application: "superadmin", applications: [valid] }));
});

test("a successful switch only opens the requested authorized grant and its fixed application destination", () => {
    for (const kind of Object.keys(APPLICATION_DESTINATIONS) as ApplicationAccessKind[]) {
        const chosen = application(kind);
        assert.equal(resolveApplicationSwitchTarget(chosen, { application: chosen, target_path: chosen.href, access_token: "ignored-http-only-session" }), chosen.href);
        assert.throws(() => resolveApplicationSwitchTarget(chosen, { application: { ...chosen, key: "other-grant" }, target_path: chosen.href }));
        assert.throws(() => resolveApplicationSwitchTarget(chosen, { application: { ...chosen, company_id: 2 }, target_path: chosen.href }));
        for (const target of ["https://outside.example", "//outside.example", "/accesos", `${chosen.href}?next=/dashboard`]) {
            assert.throws(() => resolveApplicationSwitchTarget(chosen, { application: chosen, target_path: target }));
        }
    }
});

test("revoked or empty access lists do not invent an application or an active grant", () => {
    const workspace = readApplicationWorkspace({ current_application: "client", current_key: "client:revoked", applications: [] });
    assert.deepEqual(workspace.applications, []);
    assert.equal(isCurrentApplication(workspace, application("client")), false);
    assert.deepEqual(readApplicationAccess({ ...application("client"), company_id: null, company_name: null }).company_id, null);
});
