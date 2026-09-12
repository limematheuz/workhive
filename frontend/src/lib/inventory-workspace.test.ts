import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const page = read("../app/dashboard/inventory/page.tsx");
const service = read("../services/inventory.service.ts");
const sidebar = read("../components/dashboard/sidebar-nav-config.tsx");

test("inventory workspace uses the service layer and is visible in Operations", () => {
    assert.match(page, /InventoryService\.getStockBalances/);
    assert.match(page, /InventoryService\.createMovement/);
    assert.match(page, /InventoryLotsSection/);
    assert.match(page, /InventoryPurchasesSection/);
    assert.match(page, /canViewFinance\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /canManageFinance\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /DataListTable/);
    assert.match(page, /PremiumTabs/);
    assert.doesNotMatch(page, /\bfetch\s*\(/);

    assert.match(service, /"\/api\/v1\/inventory\/suppliers"/);
    assert.match(service, /"\/api\/v1\/inventory\/materials"/);
    assert.match(service, /"\/api\/v1\/inventory\/warehouses"/);
    assert.match(service, /"\/api\/v1\/inventory\/movements"/);
    assert.match(service, /"\/api\/v1\/inventory\/stock"/);
    assert.match(service, /"\/api\/v1\/inventory\/lots"/);
    assert.match(service, /"\/api\/v1\/inventory\/purchases\/"/);
    assert.match(service, /\/api\/v1\/inventory\/purchases\/\$\{purchaseId\}\/reverse/);

    assert.match(sidebar, /href: "\/dashboard\/inventory", label: "Inventario"/);
    assert.match(sidebar, /"\/dashboard\/inventory": "features\.inventory"/);
});
