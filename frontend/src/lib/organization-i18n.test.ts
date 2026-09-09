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
    assert.equal(en.organization.actions.invite_person, "Invite person");
    assert.equal(es.organization.actions.invite_person, "Invitar persona");
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
