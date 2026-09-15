import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const sourceRoot = new URL("../", import.meta.url);

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

function tsxSources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return tsxSources(path);
        return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")
            ? [readFileSync(path, "utf8")]
            : [];
    });
}

test("application forms use the shared calendar controls instead of browser date fields", () => {
    for (const content of tsxSources(sourceRoot.pathname)) {
        assert.doesNotMatch(content, /type="(?:date|datetime-local)"/);
    }

    const datePicker = source("../components/ui/date-picker.tsx");
    const dateTimePicker = source("../components/ui/date-time-picker.tsx");
    assert.match(datePicker, /<Calendar/);
    assert.match(datePicker, /onValueChange\(""\)/);
    assert.match(dateTimePicker, /min\?: string \| null/);
    assert.match(dateTimePicker, /max\?: string \| null/);
    assert.match(dateTimePicker, /clearable\?: boolean/);
    assert.match(dateTimePicker, /clampToBounds/);

    for (const formSource of [
        source("../app/dashboard/labor-costs/page.tsx"),
        source("../app/dashboard/quality/page.tsx"),
        source("../app/dashboard/work-orders/page.tsx"),
        source("../components/contracts/ServiceContractDetailDialog.tsx"),
        source("../components/expenses/ExpenseFormDialog.tsx"),
        source("../components/inventory/InventoryPurchasesSection.tsx"),
        source("../components/invoices/CustomerPaymentSection.tsx"),
        source("../components/partner-portal/PartnerPortalRequestDialog.tsx"),
        source("../features/reservations/ReservationFormCleaningSection.tsx"),
        source("../features/reservations/ReservationFormMainFields.tsx"),
    ]) {
        assert.match(formSource, /(?:DatePicker|DateTimePicker)/);
    }
});
