import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    PAGE_ACTION_BUTTON_BASE,
    PAGE_ACTION_BUTTON_PRIMARY,
} from "./page-action-button.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("PAGE_ACTION_BUTTON_PRIMARY includes Export CTA metrics", () => {
    for (const token of ["text-xs", "font-semibold", "px-5", "py-2.5", "gap-1.5", "rounded-xl"]) {
        assert.match(PAGE_ACTION_BUTTON_PRIMARY, new RegExp(token));
    }
    assert.match(PAGE_ACTION_BUTTON_PRIMARY, /--btn-primary-bg/);
    assert.ok(PAGE_ACTION_BUTTON_PRIMARY.startsWith(PAGE_ACTION_BUTTON_BASE));
});

test("cancel and dismiss actions use the shared shadcn cancel variant", () => {
    const variants = read("../components/ui/button-variants.ts");

    assert.match(variants, /cancel: "border-transparent bg-\[var\(--btn-neutral-bg\)\]/);
    assert.match(variants, /hover:bg-\[var\(--btn-neutral-hover-bg\)\]/);
    assert.doesNotMatch(read("../app/globals.css"), /\.btn-cancel-muted\s*\{/);
});

test("profile Cancelar / Cerrar Editor use the shared cancel variant", () => {
    const page = read("../app/dashboard/profile/page.tsx");
    const details = read("../components/profile/ProfileDetailsForm.tsx");
    const password = read("../components/profile/PasswordChangeForm.tsx");
    const company = read("../components/profile/CompanyDetailsFormFields.tsx");

    for (const source of [page, details, password, company]) {
        assert.match(source, /variant="cancel"/);
        assert.doesNotMatch(source, /btn-cancel-muted/);
    }
});

test("PrivacyControls Export CTA uses PAGE_ACTION_BUTTON_PRIMARY", () => {
    const source = read("../components/profile/PrivacyControls.tsx");
    assert.match(source, /PAGE_ACTION_BUTTON_PRIMARY/);
    assert.match(source, /className=\{PAGE_ACTION_BUTTON_PRIMARY\}/);
    assert.doesNotMatch(
        source,
        /Exportar mis datos[\s\S]{0,200}inline-flex items-center justify-center gap-1\.5 rounded-xl border border-\[var\(--btn-primary-bg\)\]/,
    );
});

test("spot-check page CTAs import and use PAGE_ACTION_BUTTON_PRIMARY", () => {
    const paths = [
        "../app/dashboard/quotes/page.tsx",
        "../app/dashboard/expenses/page.tsx",
        "../app/dashboard/tasks/page.tsx",
        "../components/invoices/InvoicesPageHeader.tsx",
        "../app/dashboard/roles/page.tsx",
    ];

    for (const path of paths) {
        const source = read(path);
        assert.match(source, /PAGE_ACTION_BUTTON_PRIMARY/, `${path} should import/use primary page action`);
        assert.match(source, /from "@\/lib\/page-action-button"/, `${path} should import from page-action-button`);
    }
});

test("OperationsCalendar does not duplicate Nueva Tarea page CTA", () => {
    const source = read("../components/dashboard/OperationsCalendar.tsx");
    assert.doesNotMatch(source, /new_task \|\| "Nueva Tarea"/);
    assert.doesNotMatch(
        source,
        /actions=\{state\.isAdminOrManager && onCreateTask \? \(/,
    );
    // Column dashed "Añadir tarea" accent UX remains.
    assert.match(source, /add_task \|\| "Añadir tarea"/);
});

test("create CTA Plus icons rely on gap-1.5 without mr-2", () => {
    const client = read("../components/clients/CreateClientSheet.tsx");
    const location = read("../components/locations/CreateLocationSheet.tsx");
    const button = read("../components/ui/button-variants.ts");

    assert.match(client, /<Plus className="h-4 w-4" \/>/);
    assert.doesNotMatch(client, /Plus className="[^"]*mr-2/);
    assert.match(location, /<Plus className="h-4 w-4" \/>/);
    assert.doesNotMatch(location, /Plus className="[^"]*mr-2/);
    assert.match(PAGE_ACTION_BUTTON_BASE, /gap-1\.5/);
    assert.doesNotMatch(PAGE_ACTION_BUTTON_BASE, /gap-1\.5[^"]*gap-/);
    assert.match(button, /gap-1\.5 rounded-xl text-xs font-semibold/);
});
