import test from "node:test";
import assert from "node:assert/strict";
import { preparePurchaseSubmission, purchaseRequestId, purchaseTotalCents } from "./inventory-purchase-flow.ts";
import type { InventoryPurchaseInput } from "../types/inventory.ts";

const purchase: InventoryPurchaseInput = { supplier_id: 1, description: "Consumibles", expense_date: "2026-11-17T12:00:00", category: "supplies", tax_amount: "2.10", lines: [{ material_id: 2, warehouse_id: 3, quantity: "2", unit_cost: "5" }] };
const policy = { purchases_required: false, available: true };
const budget = { id: 17, description: "Consumibles aprobados", amount: "12.10" };
test("approved source always routes to a proposal even when general approval is optional", () => {
    assert.deepEqual(preparePurchaseSubmission(policy, purchase, 17, [budget]), { approvalRequired: true, sourceId: 17 });
    assert.deepEqual(preparePurchaseSubmission(policy, purchase, null, [budget]), { approvalRequired: false, sourceId: undefined });
    assert.equal(purchase.lines[0].material_id, 2);
});
test("inventory manager without finance manage can propose but cannot bypass review", () => {
    assert.equal(preparePurchaseSubmission(policy, purchase, null, [], false).approvalRequired, true);
    assert.throws(() => preparePurchaseSubmission({ ...policy, available: false }, purchase, null, [], false), /no está disponible/);
});
test("plan availability blocks mandatory approval while leaving authorized direct purchases intact", () => {
    assert.throws(() => preparePurchaseSubmission(null, purchase, null, []), /política/);
    assert.throws(() => preparePurchaseSubmission({ purchases_required: true, available: false }, purchase, null, []), /no está disponible/);
    assert.throws(() => preparePurchaseSubmission({ ...policy, available: false }, purchase, 17, [budget]), /no está disponible/);
    assert.equal(preparePurchaseSubmission({ ...policy, available: false }, purchase, null, []).approvalRequired, false);
});
test("authorized maximum includes taxes and exact rounded line totals", () => {
    assert.equal(purchaseTotalCents(purchase), BigInt(1210));
    assert.throws(() => preparePurchaseSubmission(policy, { ...purchase, tax_amount: "2.11" }, 17, [budget]), /supera el importe/);
    assert.throws(() => preparePurchaseSubmission(policy, purchase, 17, []), /ya no está disponible/);
    const fractional = { ...purchase, tax_amount: "0", lines: [{ material_id: 2, warehouse_id: 3, quantity: "1", unit_cost: "1.005" }] };
    assert.equal(purchaseTotalCents(fractional), BigInt(101));
    assert.throws(() => preparePurchaseSubmission(policy, fractional, 17, [{ ...budget, amount: "1.00" }]), /supera el importe/);
    assert.equal(purchaseTotalCents({ ...purchase, tax_amount: "-0", lines: [{ material_id: 2, warehouse_id: 3, quantity: "1E+3", unit_cost: "1E-4" }] }), BigInt(10));
});
test("deep links accept only exact positive safe identifiers", () => {
    assert.equal(purchaseRequestId("17"), 17);
    for (const value of [null, "", "0", "-1", "1x", "1.5", "01", "9007199254740992"]) assert.equal(purchaseRequestId(value), null);
});
