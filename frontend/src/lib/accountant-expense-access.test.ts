import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canAccessExternalPortalDashboardPath } from "../domain/access/accountant-dashboard.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("accountant reaches the read-only expense and receipt screen, not management routes", () => {
    assert.equal(canAccessExternalPortalDashboardPath("/dashboard/expenses"), true);
    assert.equal(canAccessExternalPortalDashboardPath("/dashboard/inventory"), false);
    assert.equal(canAccessExternalPortalDashboardPath("/dashboard/users"), false);

    const navigation = read("../components/dashboard/sidebar-nav-config.tsx");
    const page = read("../app/dashboard/expenses/page.tsx");
    const list = read("../components/expenses/ExpensesListSection.tsx");
    assert.match(navigation, /ACCOUNTANT_HREFS[^\n]*"\/dashboard\/expenses"/);
    assert.match(page, /canManageExpenses && <ExpenseReceiptDialog/);
    assert.match(page, /canManageExpenses && <ExpenseFormDialog/);
    assert.match(page, /canManageExpenses \? text\.subtitle : text\.readonly_subtitle/);
    assert.match(page, /canManageExpenses \? ClientService\.getClients\(null\) : Promise\.resolve\(\[\]\)/);
    assert.match(page, /canManageExpenses \? ServiceContractService\.getContracts\(\) : Promise\.resolve\(\[\]\)/);
    assert.match(page, /canManageExpenses \? WorkOrderService\.getWorkOrders\(\) : Promise\.resolve\(\[\]\)/);
    assert.match(read("../dictionaries/es.json"), /"readonly_subtitle": "Consulta los gastos/);
    assert.match(read("../dictionaries/en.json"), /"readonly_subtitle": "Review company expenses/);
    assert.match(list, /isPrivateExpenseReceipt\(expense\.receipt_url\)/);
    assert.match(list, /onDownloadReceipt\(expense\)/);
    assert.match(list, /!expense\.receipt_url && canManage/);
});
