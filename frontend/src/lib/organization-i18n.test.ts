import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("organization and invitation flows use the shared English and Spanish dictionaries", () => {
    const en = JSON.parse(source("../dictionaries/en.json"));
    const es = JSON.parse(source("../dictionaries/es.json"));
    const controlCenter = source("../components/organization/OrganizationControlCenter.tsx");
    const invitationDialog = source("../components/organization/OrganizationInvitePersonDialog.tsx");
    const accessDialog = source("../components/organization/MemberAccessDialog.tsx");
    const dictionaryContext = source("../lib/dictionary-context.tsx");

    assert.equal(en.organization.tabs.people, "People");
    assert.equal(es.organization.tabs.people, "Personas");
    assert.match(es.organization.access_unavailable, /permisos/);
    assert.match(en.organization.access_unavailable, /permission/);
    assert.notEqual(es.organization.access_unavailable, es.organization.configuration_unavailable);
    assert.equal(en.organization.actions.invite_person, "Invite person");
    assert.equal(es.organization.actions.invite_person, "Invitar persona");
    assert.match(es.organization.invite_dialog.admin_notice, /precios y facturas/);
    assert.match(en.organization.invite_dialog.admin_notice, /pricing and invoices/);
    assert.match(es.organization.invite_dialog.admin_invitation_description, /administrador de esta empresa/);
    assert.match(en.organization.invite_dialog.admin_invitation_description, /administrator of this company/);
    assert.match(invitationDialog, /selectedRole\?\.roleName === "admin" \? copy\.admin_notice : copy\.notice/);
    assert.match(invitationDialog, /selectedRole\?\.roleName === "admin" \? copy\.admin_invitation_description : copy\.description/);
    assert.equal(en.organization.profiles.permission_catalog["access.members.manage"], "Invite, update, suspend, and reactivate people");
    assert.equal(es.organization.profiles.permission_catalog["access.members.manage"], "Invitar, actualizar, suspender y reactivar personas");
    assert.equal(es.organization.profiles.select_category, "Seleccionar todo");
    assert.equal(es.organization.profiles.clear_category, "Deseleccionar todo");
    assert.equal(en.organization.profiles.select_category, "Select all");
    assert.equal(en.organization.profiles.clear_category, "Deselect all");
    assert.equal(es.organization.profiles.system, "Predeterminado");
    assert.equal(es.organization.profiles.protected, "Protegido");
    assert.equal(en.organization.profiles.system, "Default");
    assert.equal(en.organization.profiles.protected, "Protected");
    assert.equal(es.organization.profiles.permission_catalog["clients.manage"], "Crear y actualizar clientes");
    assert.equal(es.organization.profiles.permission_catalog["finance.read"], "Ver presupuestos, facturas, gastos y fiscalidad");
    assert.equal(es.organization.profiles.permission_catalog["commercial.follow_ups.manage"], "Gestionar seguimiento comercial");
    assert.equal(es.organization.profiles.permission_catalog["time.approve"], "Revisar correcciones de fichajes");
    assert.equal(es.organization.profiles.default_name_locked, "El nombre identifica esta plantilla recomendada y no se puede cambiar.");
    assert.equal(es.organization.filters.search_people, "Buscar por nombre, correo o perfil");
    assert.equal(es.organization.filters.clear, "Limpiar filtros");
    assert.equal(en.organization.filters.search_profiles, "Search by name, description, or permission");
    assert.equal(en.organization.filters.summary, "{shown} of {total} results");
    assert.match(controlCenter, /useDictionary/);
    assert.match(invitationDialog, /useDictionary/);
    assert.match(accessDialog, /useDictionary/);
    assert.match(accessDialog, /profile\.is_editable/);
    assert.match(dictionaryContext, /DEFAULT_LOCALE: Locale = "es"/);
    assert.match(dictionaryContext, /return stored === "en" \? "en" : "es"/);
});

test("every built-in permission has a localized category, label, and explanation", () => {
    const en = JSON.parse(source("../dictionaries/en.json"));
    const es = JSON.parse(source("../dictionaries/es.json"));
    const backendSource = source("../../../backend/app/services/organization_base_profile_service.py");
    const definitions = backendSource.split("DEFAULT_PERMISSION_DEFINITIONS:")[1].split("COMMERCIAL_PERMISSION_CODES")[0];
    const permissions = [...definitions.matchAll(/\(\s*"([a-z_]+\.[a-z_.]+)",\s*"([a-z_]+)",/g)];
    assert.ok(permissions.length >= 30);

    for (const [, code, category] of permissions) {
        for (const dictionary of [es, en]) {
            assert.ok(dictionary.organization.profiles.permission_categories[category], `${category} category is missing`);
            assert.ok(dictionary.organization.profiles.permission_catalog[code], `${code} label is missing`);
            assert.ok(dictionary.organization.profiles.permission_guidance[code], `${code} guidance is missing`);
        }
    }
});
