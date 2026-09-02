import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("companies admin uses shadcn Table, responsive cards, and pagination", () => {
    const page = source("../app/dashboard/companies/page.tsx");
    const list = source("../components/companies/CompaniesListSection.tsx");
    const requests = source("../components/companies/TrialRequestsPanel.tsx");
    const members = source("../components/companies/CompanyMembersPanel.tsx");
    const provision = source("../components/companies/CompanyProvisionDialog.tsx");
    const planAccess = source("../components/companies/CompanyPlanAccessDialog.tsx");
    const planAccessLogic = source("../components/companies/useCompanyPlanAccessDialog.ts");
    const planCatalogEditor = source("../components/companies/PlanCatalogEditorDialog.tsx");
    const entitlementEditor = source("../components/companies/EntitlementConfigurationEditor.tsx");
    const commercialConfirmation = source("../components/companies/CommercialChangeConfirmationDialog.tsx");
    const alertDialog = source("../components/ui/alert-dialog.tsx");
    const globalStyles = source("../app/globals.css");
    const utils = source("../components/companies/company-utils.ts");

    assert.match(page, /isPlatformSuperadmin\(user\)/);
    assert.match(page, /PageHeader/);
    assert.match(page, /TrialRequestsPanel/);
    assert.match(page, /CompaniesListSection/);
    assert.match(page, /Nueva empresa/);
    assert.match(page, /Gestionar planes/);
    assert.doesNotMatch(page, /btn-cancel-muted/);
    assert.doesNotMatch(page, /surface-glass-card/);

    assert.match(list, /from "@\/components\/ui\/table"/);
    assert.match(list, /<TableHeader>/);
    assert.match(list, /<TableBody>/);
    assert.match(list, /Pagination/);
    assert.match(list, /ActionPopover/);
    assert.match(list, /onToggleMembers/);
    assert.match(list, /CompanyMembersPanel/);
    assert.doesNotMatch(list, /DataListTable/);
    assert.doesNotMatch(list, /surface-glass-card/);
    assert.doesNotMatch(list, /emerald|color-green|text-green-|bg-green-/);

    assert.match(requests, /billing-surface/);
    assert.match(requests, /billing-block/);
    assert.match(requests, /from "@\/components\/ui\/select"/);
    assert.match(requests, /from "@\/components\/ui\/textarea"/);
    assert.match(requests, /Prueba \(Top\)/);
    assert.match(requests, /Enterprise/);
    assert.match(requests, /variant="outline"/);
    assert.doesNotMatch(requests, /<select/);
    assert.doesNotMatch(requests, /<textarea/);
    assert.match(requests, /isPlatformSuperadmin\(user\)/);
    assert.match(requests, /py-6/);
    assert.doesNotMatch(requests, /surface-glass-card/);
    assert.doesNotMatch(requests, /emerald|color-green|text-green-|bg-green-/);
    assert.doesNotMatch(requests, /btn-cancel-muted/);

    assert.match(members, /billing-block/);
    assert.doesNotMatch(members, /glass-panel/);

    assert.doesNotMatch(utils, /emerald|color-green|text-green-|bg-green-/);
    assert.match(utils, /border-accent\/25 bg-accent\/10 text-accent/);
    assert.match(utils, /Prueba · Top/);

    assert.match(provision, /from "@\/components\/ui\/select"/);
    assert.match(provision, /Prueba \(Top\)/);
    assert.match(provision, /Enterprise/);
    assert.match(provision, /variant="outline"/);
    assert.doesNotMatch(provision, /<select/);

    assert.match(planAccess, /from "@\/components\/ui\/dialog"/);
    assert.match(planAccess, /from "@\/components\/ui\/select"/);
    assert.match(planAccess, /from "@\/components\/ui\/textarea"/);
    assert.match(planAccessLogic, /replaceCustomization/);
    assert.match(planAccess, /CommercialChangeConfirmationDialog/);
    assert.match(planAccess, /Confirmar cambio de plan/);
    assert.match(planAccess, /Confirmar configuración personalizada/);
    assert.match(planAccessLogic, /base_entitlements/);
    assert.match(planAccess, /hover:bg-accent\/10/);
    assert.match(planAccess, /Personalizar funciones y capacidad/);
    assert.match(planAccess, /max-h-\[calc\(100vh-1rem\)\].*flex-col.*overflow-hidden/);
    assert.match(planAccess, /min-h-0 flex-1 overflow-y-auto/);
    assert.doesNotMatch(planAccess, /<select/);
    assert.doesNotMatch(planAccess, /<textarea/);

    assert.match(planCatalogEditor, /updatePlanCatalog/);
    assert.match(planCatalogEditor, /Publicar nueva versión/);
    assert.match(planCatalogEditor, /CommercialChangeConfirmationDialog/);
    assert.match(entitlementEditor, /from "@\/components\/ui\/checkbox"/);
    assert.match(entitlementEditor, /from "@\/components\/ui\/button"/);
    assert.match(entitlementEditor, /Funciones disponibles/);
    assert.match(entitlementEditor, /Próximamente/);
    assert.match(entitlementEditor, /Interna de plataforma/);
    assert.match(entitlementEditor, /disabled=\{!canConfigure\}/);
    assert.match(entitlementEditor, /flex min-w-0 items-center gap-3/);
    assert.match(entitlementEditor, /Capacidades/);
    assert.match(entitlementEditor, /Reducir \$\{item.label\}/);
    assert.match(entitlementEditor, /Aumentar \$\{item.label\}/);
    assert.match(commercialConfirmation, /AlertDialog/);
    assert.match(commercialConfirmation, /He revisado el impacto y autorizo este cambio/);
    assert.match(globalStyles, /label:not\(:has\(\[data-slot="checkbox"\], input\[type="checkbox"\]\)\)/);
    assert.match(source("../components/companies/commercial-change-utils.ts"), /entitlementChanges/);
    assert.match(alertDialog, /AlertDialogPrimitive/);
});
