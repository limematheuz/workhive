export type InventoryUnit = "unit" | "liter" | "kilogram" | "box" | "package";
export type InventoryMovementType = "receipt" | "issue" | "adjustment_in" | "adjustment_out";

export type InventorySupplier = {
    id: number;
    name: string;
    tax_id: string | null;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type InventoryMaterial = {
    id: number;
    sku: string;
    name: string;
    description: string | null;
    unit: InventoryUnit;
    supplier_id: number | null;
    reorder_point: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type InventoryWarehouse = {
    id: number;
    name: string;
    address: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type InventoryMovement = {
    id: number;
    material_id: number;
    warehouse_id: number;
    lot_id: number | null;
    work_order_id: number | null;
    client_id: number | null;
    reversal_of_movement_id: number | null;
    movement_type: InventoryMovementType;
    quantity: string;
    unit_cost: string | null;
    reference: string | null;
    notes: string | null;
    recorded_by_user_id: number | null;
    created_at: string;
    material_name: string | null;
    warehouse_name: string | null;
    lot_code?: string | null;
};

export type InventoryStockBalance = {
    material_id: number;
    material_sku: string;
    material_name: string;
    unit: InventoryUnit;
    warehouse_id: number;
    warehouse_name: string;
    available_quantity: string;
    reorder_point: string;
    is_below_reorder_point: boolean;
};

export type InventoryLot = {
    id: number;
    material_id: number;
    material_sku: string;
    material_name: string;
    warehouse_id: number;
    warehouse_name: string;
    code: string;
    expires_at: string | null;
    expiry_status?: "undated" | "valid" | "expiring" | "expired";
    available_quantity: string;
    created_at: string;
};

export type InventoryPurchaseStatus = "received" | "reversed";

export type InventoryPurchaseExpense = {
    id: number;
    expense_date: string;
    client_id: number | null;
    vendor: string | null;
    category: string;
    description: string;
    payment_method: string | null;
    base_amount: number;
    tax_amount: number;
    total_amount: number;
    receipt_url: string | null;
    notes: string | null;
    is_active: boolean;
};

export type InventoryPurchaseLine = {
    id: number;
    material_id: number;
    warehouse_id: number;
    movement_id: number;
    lot_id: number | null;
    quantity: string;
    unit_cost: string;
};

export type InventoryPurchase = {
    id: number;
    supplier_id: number;
    expense_id: number;
    status: InventoryPurchaseStatus;
    supplier_name_snapshot: string;
    supplier_tax_id_snapshot: string | null;
    reference: string | null;
    notes: string | null;
    created_by_user_id: number | null;
    received_at: string;
    reversed_at: string | null;
    reversed_by_user_id: number | null;
    reversal_reason: string | null;
    expense: InventoryPurchaseExpense;
    lines: InventoryPurchaseLine[];
};

export type InventorySupplierInput = Pick<
    InventorySupplier,
    "name" | "tax_id" | "contact_name" | "email" | "phone" | "notes"
>;

export type InventoryMaterialInput = Pick<
    InventoryMaterial,
    "sku" | "name" | "description" | "unit" | "supplier_id" | "reorder_point"
>;

export type InventoryWarehouseInput = Pick<InventoryWarehouse, "name" | "address">;

export type InventoryMovementInput = Pick<
    InventoryMovement,
    "material_id" | "warehouse_id" | "lot_id" | "movement_type" | "quantity" | "unit_cost" | "reference" | "notes"
>;

export type InventoryPurchaseLineInput = Pick<
    InventoryPurchaseLine,
    "material_id" | "warehouse_id" | "quantity" | "unit_cost"
>;

export type InventoryPurchaseLotLineInput = InventoryPurchaseLineInput & {
    lot_code?: string | null;
    lot_expires_at?: string | null;
};

export type InventoryWorkOrderConsumptionInput = {
    material_id: number;
    warehouse_id: number;
    lot_id?: number | null;
    quantity: string;
    notes?: string | null;
};

export type InventoryPurchaseInput = {
    supplier_id: number;
    expense_date: string;
    client_id?: number | null;
    category: string;
    description: string;
    payment_method?: string | null;
    tax_amount: string;
    receipt_url?: string | null;
    reference?: string | null;
    notes?: string | null;
    lines: InventoryPurchaseLotLineInput[];
};
