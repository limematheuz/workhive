import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type {
    InventoryMaterial,
    InventoryMaterialInput,
    InventoryMovement,
    InventoryMovementInput,
    InventoryPurchase,
    InventoryPurchaseInput,
    InventoryLot,
    InventoryStockBalance,
    InventorySupplier,
    InventorySupplierInput,
    InventoryWarehouse,
    InventoryWarehouseInput,
} from "@/types/inventory";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await apiFetch(path, { cache: "no-store", ...options });
    await assertApiResponseOk(response, "No se pudo completar la operación de inventario.");
    return response.json() as Promise<T>;
}

export const InventoryService = {
    getSuppliers: () => request<InventorySupplier[]>("/api/v1/inventory/suppliers"),
    createSupplier: (input: InventorySupplierInput) => request<InventorySupplier>(
        "/api/v1/inventory/suppliers",
        { method: "POST", body: JSON.stringify(input) },
    ),
    getMaterials: () => request<InventoryMaterial[]>("/api/v1/inventory/materials"),
    getLots: () => request<InventoryLot[]>("/api/v1/inventory/lots"),
    createMaterial: (input: InventoryMaterialInput) => request<InventoryMaterial>(
        "/api/v1/inventory/materials",
        { method: "POST", body: JSON.stringify(input) },
    ),
    getWarehouses: () => request<InventoryWarehouse[]>("/api/v1/inventory/warehouses"),
    createWarehouse: (input: InventoryWarehouseInput) => request<InventoryWarehouse>(
        "/api/v1/inventory/warehouses",
        { method: "POST", body: JSON.stringify(input) },
    ),
    getMovements: () => request<InventoryMovement[]>("/api/v1/inventory/movements"),
    createMovement: (input: InventoryMovementInput) => request<InventoryMovement>(
        "/api/v1/inventory/movements",
        { method: "POST", body: JSON.stringify(input) },
    ),
    getPurchases: () => request<InventoryPurchase[]>("/api/v1/inventory/purchases/"),
    createPurchase: (input: InventoryPurchaseInput) => request<InventoryPurchase>(
        "/api/v1/inventory/purchases/",
        { method: "POST", body: JSON.stringify(input) },
    ),
    reversePurchase: (purchaseId: number, reason: string) => request<InventoryPurchase>(
        `/api/v1/inventory/purchases/${purchaseId}/reverse`,
        { method: "POST", body: JSON.stringify({ reason }) },
    ),
    getStockBalances: () => request<InventoryStockBalance[]>("/api/v1/inventory/stock"),
};
