import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("reservations page shell uses billing surface without top accent pad", () => {
    const layout = source("../features/reservations/ReservationsPageLayout.tsx");
    const filters = source("../features/reservations/ReservationsFilters.tsx");
    const filterStyles = source("../features/reservations/reservation-filter-styles.ts");
    const list = source("../features/reservations/ReservationList.tsx");
    const listSection = source("../features/reservations/ReservationsListSection.tsx");

    assert.match(layout, /billing-surface/);
    assert.match(layout, /PremiumTabs/);
    assert.match(layout, /PageHeader|ReservationsPageHeader/);
    assert.doesNotMatch(layout, /billing-surface-accent-pad/);
    assert.doesNotMatch(layout, /absolute left-4 right-4 top-3 h-1\.5/);
    assert.doesNotMatch(layout, /rounded-full bg-accent/);
    assert.doesNotMatch(layout, /btn-cancel-muted/);
    assert.doesNotMatch(layout, /surface-glass-card/);

    assert.match(filters, /billing-block/);
    assert.match(filters, /PremiumTabs/);
    assert.match(filters, /from "@\/components\/ui\/input"/);
    assert.match(filters, /from "@\/components\/ui\/checkbox"/);
    assert.match(filters, /from "@\/components\/ui\/button"/);
    assert.match(filters, /CompactFilterSelect/);
    assert.match(filters, /reservationFilterSelectClass/);
    assert.doesNotMatch(filters, /<select\b/);
    assert.match(filters, /flex flex-wrap gap-2/);
    assert.match(filterStyles, /w-auto min-w-\[9\.5rem\]/);
    assert.doesNotMatch(filters, /xl:grid-cols-6/);
    assert.doesNotMatch(filters, /rounded-3xl shadow-sm/);

    assert.match(list, /billing-block/);
    assert.match(list, /from "@\/components\/ui\/badge"/);
    assert.match(list, /variant="dangerSoft"/);
    assert.match(list, /variant="secondary"/);
    assert.doesNotMatch(list, /surface-glass-card/);
    assert.doesNotMatch(list, /emerald|text-green-|bg-green-|color-green/);
    assert.doesNotMatch(list, /btn-cancel-muted/);

    assert.match(listSection, /ReservationsFilters/);
    assert.match(listSection, /ReservationList/);
});

test("solicitudes tab reuses dense billing filter and card language", () => {
    const requests = source("../components/tasks/TasksRequests.tsx");
    const filters = source("../components/tasks/TasksRequestsFilters.tsx");
    const card = source("../components/tasks/TaskRequestCard.tsx");

    assert.match(requests, /billing-block/);
    assert.match(filters, /billing-block/);
    assert.match(filters, /reservation-filter-styles/);
    assert.match(filters, /from "@\/components\/ui\/input"/);
    assert.match(filters, /CompactFilterSelect/);
    assert.doesNotMatch(filters, /<select\b/);
    assert.match(filters, /flex flex-wrap gap-2/);
    assert.doesNotMatch(filters, /h-11 w-full/);

    assert.match(card, /billing-block/);
    assert.match(card, /from "@\/components\/ui\/badge"/);
    assert.match(card, /variant="dangerSoft"/);
    assert.doesNotMatch(card, /surface-glass-card/);
    assert.doesNotMatch(card, /emerald|text-green-|bg-green-/);
});

test("reservation cleaning completed status uses accent, not green", () => {
    const list = source("../features/reservations/ReservationList.tsx");

    assert.match(list, /status === "completed"\) return "text-accent"/);
    assert.doesNotMatch(list, /text-emerald/);
});

test("reservations require the planning entitlement before loading data", () => {
    const page = source("../app/dashboard/reservations/page.tsx");
    const layout = source("../features/reservations/ReservationsPageLayout.tsx");
    const access = source("../features/reservations/usePlanningFeatureAccess.ts");
    const requests = source("../features/reservations/useReservationRequests.ts");
    const sidebar = source("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(page, /usePlanningFeatureAccess\(user\)/);
    assert.match(access, /CompanyPlanAccessService\.getCurrentEntitlements\(\)/);
    assert.match(access, /entitlement\.code === "features\.planning"/);
    assert.match(page, /if \(!hasPlanningAccess\) return;/);
    assert.match(page, /ReservationsPlanRequired/);
    assert.match(layout, /Planificación no incluida/);
    assert.match(requests, /if \(!hasPlanningAccess \|\| !canManage\) return;/);
    assert.doesNotMatch(sidebar, /"\/dashboard\/calendar": "features\.planning"/);
    assert.match(sidebar, /"\/dashboard\/reservations": "features\.planning"/);
});
