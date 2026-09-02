import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
    new URL("../components/auth/PasswordCreationFields.tsx", import.meta.url),
    "utf8",
);
const invitationPage = readFileSync(
    new URL("../app/(auth)/accept-invitation/page.tsx", import.meta.url),
    "utf8",
);

test("password creation uses the shadcn input group so the visibility control stays inside the field", () => {
    assert.match(source, /@\/components\/ui\/input-group/);
    assert.match(source, /<InputGroup className="h-11">/);
    assert.match(source, /<InputGroupAddon align="inline-end">/);
    assert.match(source, /<InputGroupButton/);
    assert.match(source, /aria-pressed=\{visible\}/);
    assert.doesNotMatch(source, /DocumentFormInput/);
    assert.doesNotMatch(source, /absolute right-1/);
});

test("password creation keeps the legal checkbox beside its label using shadcn fields", () => {
    assert.match(source, /@\/components\/ui\/field/);
    assert.match(source, /<Field orientation="horizontal"/);
    assert.match(source, /<Checkbox id=\{`\$\{idPrefix\}-legal`\}/);
    assert.match(source, /<FieldLabel htmlFor=\{`\$\{idPrefix\}-legal`\}/);
});

test("worker invitation uses shadcn fields for its verification code as well as both passwords", () => {
    assert.match(invitationPage, /@\/components\/ui\/field/);
    assert.match(invitationPage, /@\/components\/ui\/input/);
    assert.match(invitationPage, /<FieldLabel htmlFor="worker-invitation-code">/);
    assert.match(invitationPage, /<Input\s+id="worker-invitation-code"/);
    assert.doesNotMatch(invitationPage, /ChangeEvent<HTMLInputElement>/);
});
