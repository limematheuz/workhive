import type { InventoryPurchaseInput } from "../types/inventory.ts";
type PurchasePolicy = { available: boolean; purchases_required: boolean };
type PurchaseBudget = { id: number; description: string; amount: string };

export function purchaseRequestId(value: string | null | undefined): number | null {
    if (!value || !/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}
function scaled(value: string, places: number): bigint {
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value);
    if (!match) throw new Error("Revisa los importes y cantidades de la compra.");
    const digits = BigInt(match[2] + (match[3] ?? ""));
    if (digits === BigInt(0)) return BigInt(0);
    const exponent = Number(match[4] ?? 0), scale = places + exponent - (match[3]?.length ?? 0);
    if (Math.abs(exponent) > 20 || (match[1] && digits !== BigInt(0))) throw new Error("Revisa los importes y cantidades de la compra.");
    if (scale >= 0) return digits * BigInt(10) ** BigInt(scale);
    const divisor = BigInt(10) ** BigInt(-scale);
    if (digits % divisor !== BigInt(0)) throw new Error("Los importes o cantidades tienen demasiados decimales.");
    return digits / divisor;
}
export function purchaseTotalCents(purchase: InventoryPurchaseInput): bigint {
    const base = purchase.lines.reduce((sum, line) => sum + scaled(line.quantity, 3) * scaled(line.unit_cost, 4), BigInt(0));
    return (base + BigInt(50000)) / BigInt(100000) + scaled(purchase.tax_amount || "0", 2);
}
export function preparePurchaseSubmission(policy: PurchasePolicy | null, purchase: InventoryPurchaseInput, sourceId: number | null, budgets: readonly PurchaseBudget[], canRecord = true) {
    if (!policy) throw new Error("Espera a que se compruebe la política de aprobación.");
    const approvalRequired = policy.purchases_required || sourceId !== null || !canRecord;
    if (approvalRequired && !policy.available) throw new Error("La aprobación es obligatoria y no está disponible en el plan actual. Revisa la configuración antes de registrar compras.");
    const total = purchaseTotalCents(purchase);
    if (sourceId !== null) {
        const budget = budgets.find(item => item.id === sourceId);
        if (!budget) throw new Error("La autorización ya no está disponible. Actualiza y revisa la solicitud.");
        if (total > scaled(budget.amount, 2)) throw new Error("El total de la compra supera el importe autorizado. Ajusta las líneas o revisa la autorización.");
    }
    return { approvalRequired, sourceId: sourceId ?? undefined };
}
