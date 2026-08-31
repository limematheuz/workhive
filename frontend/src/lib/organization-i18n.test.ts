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
    assert.match(controlCenter, /useDictionary/);
    assert.match(invitationDialog, /useDictionary/);
    assert.match(accessDialog, /useDictionary/);
    assert.match(dictionaryContext, /DEFAULT_LOCALE: Locale = "es"/);
    assert.match(dictionaryContext, /return stored === "en" \? "en" : "es"/);
});
