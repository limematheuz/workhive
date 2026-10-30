"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowDownToLine, ArrowUpFromLine, Boxes, Building2, CircleDollarSign, Layers3, PackagePlus, ShieldAlert, type LucideIcon, Warehouse } from "lucide-react";

import { InventoryLotsSection } from "@/components/inventory/InventoryLotsSection";
import { InventoryPurchasesSection } from "@/components/inventory/InventoryPurchasesSection";
import { Button } from "@/components/ui/button";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { canManageFinance, canViewFinance, isPlatformSuperadmin } from "@/domain/access/roles";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { InventoryNavigation } from "@/components/inventory/InventoryNavigation";
import type { InventoryView as InventoryTab } from "@/lib/inventory-navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { InventoryService } from "@/services/inventory.service";
import { OrganizationService } from "@/services/organization.service";
import type {
    InventoryMaterial,
    InventoryMovement,
    InventoryMovementType,
    InventoryLot,
    InventoryPurchase,
    InventoryStockBalance,
    InventorySupplier,
    InventoryUnit,
    InventoryWarehouse,
} from "@/types/inventory";

type ArchiveTarget = {
    kind: "supplier" | "material" | "warehouse";
    id: number;
    name: string;
};

const unitLabels: Record<InventoryUnit, string> = {
    unit: "unidades",
    liter: "litros",
    kilogram: "kg",
    box: "cajas",
    package: "paquetes",
};

const movementLabels: Record<InventoryMovementType, string> = {
    receipt: "Entrada",
    issue: "Salida",
    adjustment_in: "Ajuste de entrada",
    adjustment_out: "Ajuste de salida",
};

const baseTabs: Array<{ id: InventoryTab; label: string; icon: LucideIcon }> = [
    { id: "stock", label: "Stock", icon: Boxes },
    { id: "materials", label: "Materiales", icon: PackagePlus },
    { id: "suppliers", label: "Proveedores", icon: Building2 },
    { id: "warehouses", label: "Almacenes", icon: Warehouse },
    { id: "movements", label: "Movimientos", icon: ArrowDownToLine },
    { id: "lots", label: "Lotes", icon: Layers3 },
];

const stockColumns: DataListColumn[] = [
    { key: "material", label: "Material", className: "w-[34%]" },
    { key: "warehouse", label: "Almacén", className: "w-[24%]" },
    { key: "available", label: "Disponible", className: "w-[18%] text-right" },
    { key: "reorder", label: "Reposición", className: "w-[24%]" },
];

const materialColumns: DataListColumn[] = [
    { key: "material", label: "Material", className: "w-[38%]" },
    { key: "supplier", label: "Proveedor", className: "w-[28%]" },
    { key: "unit", label: "Unidad", className: "w-[16%]" },
    { key: "reorder", label: "Reposición", className: "w-[18%] text-right" },
    { key: "actions", label: <span className="sr-only">Acciones</span>, className: "w-[3rem] text-right" },
];

const supplierColumns: DataListColumn[] = [
    { key: "supplier", label: "Proveedor", className: "w-[42%]" },
    { key: "contact", label: "Contacto", className: "w-[30%]" },
    { key: "email", label: "Correo", className: "w-[28%]" },
    { key: "actions", label: <span className="sr-only">Acciones</span>, className: "w-[3rem] text-right" },
];

const warehouseColumns: DataListColumn[] = [
    { key: "warehouse", label: "Almacén", className: "w-[44%]" },
    { key: "address", label: "Dirección", className: "w-[56%]" },
    { key: "actions", label: <span className="sr-only">Acciones</span>, className: "w-[3rem] text-right" },
];

const movementColumns: DataListColumn[] = [
    { key: "movement", label: "Movimiento", className: "w-[30%]" },
    { key: "material", label: "Material", className: "w-[27%]" },
    { key: "warehouse", label: "Almacén", className: "w-[23%]" },
    { key: "quantity", label: "Cantidad", className: "w-[20%] text-right" },
];

const quantityFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });

function quantity(value: string) {
    return quantityFormatter.format(Number(value));
}

function optional(value: string): string | null {
    const trimmed = value.trim();
    return trimmed || null;
}

export default function InventoryPage() {
    const { user, loading: userLoading } = useUser();
    const [inventoryAccess, setInventoryAccess] = useState<{
        canRead: boolean;
        canManage: boolean;
    } | null>(null);
    const canReadInventory = inventoryAccess?.canRead === true;
    const canManageInventory = inventoryAccess?.canManage === true;
    const canViewPurchases = canViewFinance(user) && !isPlatformSuperadmin(user);
    const canManagePurchases = canManageFinance(user)
        && canManageInventory
        && !isPlatformSuperadmin(user);
    const [activeTab, setActiveTab] = useState<InventoryTab>("stock");
    const [inventoryData, setInventoryData] = useState({
        suppliers: [] as InventorySupplier[],
        materials: [] as InventoryMaterial[],
        warehouses: [] as InventoryWarehouse[],
        movements: [] as InventoryMovement[],
        stock: [] as InventoryStockBalance[],
        lots: [] as InventoryLot[],
        purchases: [] as InventoryPurchase[],
    });
    const { suppliers, materials, warehouses, movements, stock, lots, purchases } = inventoryData;
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [supplierName, setSupplierName] = useState("");
    const [supplierEmail, setSupplierEmail] = useState("");
    const [materialSku, setMaterialSku] = useState("");
    const [materialName, setMaterialName] = useState("");
    const [materialUnit, setMaterialUnit] = useState<InventoryUnit>("unit");
    const [materialSupplierId, setMaterialSupplierId] = useState("none");
    const [reorderPoint, setReorderPoint] = useState("0");
    const [warehouseName, setWarehouseName] = useState("");
    const [warehouseAddress, setWarehouseAddress] = useState("");
    const [movementMaterialId, setMovementMaterialId] = useState("");
    const [movementWarehouseId, setMovementWarehouseId] = useState("");
    const [movementLotId, setMovementLotId] = useState("none");
    const [movementType, setMovementType] = useState<InventoryMovementType>("receipt");
    const [movementQuantity, setMovementQuantity] = useState("");
    const [movementReference, setMovementReference] = useState("");
    const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget | null>(null);

    useEffect(() => {
        if (userLoading) return;
        let cancelled = false;

        void OrganizationService.getAccess().then((access) => {
            if (cancelled) return;
            setInventoryAccess({
                canRead: access["inventory.read"] === true,
                canManage: access["inventory.manage"] === true,
            });
        }).catch(() => {
            if (!cancelled) {
                setInventoryAccess({ canRead: false, canManage: false });
            }
        });

        return () => {
            cancelled = true;
        };
    }, [userLoading]);

    const reload = useCallback(async () => {
        if (!canReadInventory) return;
        setLoading(true);
        try {
            const [nextSuppliers, nextMaterials, nextWarehouses, nextMovements, nextStock, nextLots, nextPurchases] = await Promise.all([
                InventoryService.getSuppliers(),
                InventoryService.getMaterials(),
                InventoryService.getWarehouses(),
                InventoryService.getMovements(),
                InventoryService.getStockBalances(),
                InventoryService.getLots(),
                canViewPurchases ? InventoryService.getPurchases() : Promise.resolve<InventoryPurchase[]>([]),
            ]);
            setInventoryData({
                suppliers: nextSuppliers,
                materials: nextMaterials,
                warehouses: nextWarehouses,
                movements: nextMovements,
                stock: nextStock,
                lots: nextLots,
                purchases: nextPurchases,
            });
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo cargar el inventario."));
        } finally {
            setLoading(false);
        }
    }, [canReadInventory, canViewPurchases]);

    useEffect(() => {
        if (userLoading || inventoryAccess === null) return;
        if (!canReadInventory) {
            return;
        }
        const timer = window.setTimeout(() => void reload(), 0);
        return () => window.clearTimeout(timer);
    }, [canReadInventory, inventoryAccess, reload, userLoading]);

    const tabs = useMemo<Array<{ id: InventoryTab; label: string; icon: LucideIcon }>>(
        () => canViewPurchases ? [...baseTabs, { id: "purchases", label: "Compras", icon: CircleDollarSign }] : baseTabs,
        [canViewPurchases],
    );

    const suppliersById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);
    const materialsById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
    const warehousesById = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);

    const addSupplier = async () => {
        if (!supplierName.trim()) return;
        setSaving(true);
        try {
            await InventoryService.createSupplier({
                name: supplierName.trim(),
                tax_id: null,
                contact_name: null,
                email: optional(supplierEmail),
                phone: null,
                notes: null,
            });
            setSupplierName("");
            setSupplierEmail("");
            toast.success("Proveedor añadido.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo añadir el proveedor."));
        } finally {
            setSaving(false);
        }
    };

    const addMaterial = async () => {
        if (!materialSku.trim() || !materialName.trim()) return;
        setSaving(true);
        try {
            await InventoryService.createMaterial({
                sku: materialSku.trim(),
                name: materialName.trim(),
                description: null,
                unit: materialUnit,
                supplier_id: materialSupplierId === "none" ? null : Number(materialSupplierId),
                reorder_point: reorderPoint || "0",
            });
            setMaterialSku("");
            setMaterialName("");
            setMaterialUnit("unit");
            setMaterialSupplierId("none");
            setReorderPoint("0");
            toast.success("Material añadido.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo añadir el material."));
        } finally {
            setSaving(false);
        }
    };

    const addWarehouse = async () => {
        if (!warehouseName.trim()) return;
        setSaving(true);
        try {
            await InventoryService.createWarehouse({ name: warehouseName.trim(), address: optional(warehouseAddress) });
            setWarehouseName("");
            setWarehouseAddress("");
            toast.success("Almacén añadido.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo añadir el almacén."));
        } finally {
            setSaving(false);
        }
    };

    const addMovement = async () => {
        if (!movementMaterialId || !movementWarehouseId || !movementQuantity || Number(movementQuantity) <= 0) return;
        setSaving(true);
        try {
            await InventoryService.createMovement({
                material_id: Number(movementMaterialId),
                warehouse_id: Number(movementWarehouseId),
                lot_id: movementLotId === "none" ? null : Number(movementLotId),
                movement_type: movementType,
                quantity: movementQuantity,
                unit_cost: null,
                reference: optional(movementReference),
                notes: null,
            });
            setMovementQuantity("");
            setMovementReference("");
            toast.success("Movimiento registrado.");
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo registrar el movimiento."));
        } finally {
            setSaving(false);
        }
    };

    const archiveCatalogEntity = async () => {
        if (!archiveTarget) return;
        setSaving(true);
        try {
            if (archiveTarget.kind === "material") {
                await InventoryService.archiveMaterial(archiveTarget.id);
            } else if (archiveTarget.kind === "supplier") {
                await InventoryService.archiveSupplier(archiveTarget.id);
            } else {
                await InventoryService.archiveWarehouse(archiveTarget.id);
            }
            toast.success(`${archiveTarget.name} archivado.`);
            setArchiveTarget(null);
            await reload();
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo archivar el registro de inventario."));
        } finally {
            setSaving(false);
        }
    };

    const renderStock = () => <DataListTable
        items={stock}
        getRowKey={(item) => `${item.material_id}:${item.warehouse_id}`}
        columns={stockColumns}
        loading={loading}
        header={{ title: "Stock disponible", subtitle: "El saldo se calcula desde el libro de movimientos.", countLabel: `${stock.length} saldos` }}
        empty={<p className="text-sm text-[var(--text-muted)]">Registra una entrada para ver el primer saldo.</p>}
        renderDesktopRow={(item) => [
            <div key="material" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.material_name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{item.material_sku}</p></div>,
            <span key="warehouse" className="truncate text-sm text-[var(--text-main)]">{item.warehouse_name}</span>,
            <span key="available" className="block text-right text-sm font-semibold text-[var(--text-main)]">{quantity(item.available_quantity)} {unitLabels[item.unit]}</span>,
            <span key="reorder" className={item.is_below_reorder_point ? "inline-flex rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive" : "text-sm text-[var(--text-muted)]"}>{item.is_below_reorder_point ? "Reponer" : `Mínimo ${quantity(item.reorder_point)}`}</span>,
        ]}
        renderCompactRow={(item) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.material_name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.warehouse_name}</p></div><span className="shrink-0 text-sm font-semibold text-[var(--text-main)]">{quantity(item.available_quantity)} {unitLabels[item.unit]}</span></div>}
    />;

    const renderMaterials = () => <DataListTable
        items={materials}
        getRowKey={(item) => item.id}
        columns={materialColumns}
        loading={loading}
        header={{ title: "Catálogo de material", subtitle: "Cada SKU pertenece a esta empresa y conserva su unidad de stock.", countLabel: `${materials.length} materiales` }}
        toolbar={canManageInventory ? <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.8fr)_7rem_auto]"><Input value={materialSku} onChange={(event) => setMaterialSku(event.target.value)} placeholder="SKU" aria-label="SKU" /><Input value={materialName} onChange={(event) => setMaterialName(event.target.value)} placeholder="Nombre del material" aria-label="Nombre del material" /><Select value={materialUnit} onValueChange={(value) => setMaterialUnit(value as InventoryUnit)}><SelectTrigger aria-label="Unidad"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(unitLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Select value={materialSupplierId} onValueChange={setMaterialSupplierId}><SelectTrigger aria-label="Proveedor preferido"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin proveedor</SelectItem>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={String(supplier.id)}>{supplier.name}</SelectItem>)}</SelectContent></Select><Input value={reorderPoint} onChange={(event) => setReorderPoint(event.target.value)} type="number" min="0" step="0.001" aria-label="Punto de reposición" /><Button type="button" className="sm:col-span-2 2xl:col-span-1" disabled={!materialSku.trim() || !materialName.trim() || saving} onClick={() => void addMaterial()}><PackagePlus className="size-4" />Añadir material</Button></div> : undefined}
        empty={<p className="text-sm text-[var(--text-muted)]">Crea el catálogo antes de registrar stock.</p>}
        renderDesktopRow={(item) => [
            <div key="material" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{item.sku}</p></div>,
            <span key="supplier" className="truncate text-sm text-[var(--text-main)]">{item.supplier_id ? suppliersById.get(item.supplier_id)?.name ?? "—" : "Sin proveedor"}</span>,
            <span key="unit" className="text-sm text-[var(--text-muted)]">{unitLabels[item.unit]}</span>,
            <span key="reorder" className="block text-right text-sm text-[var(--text-main)]">{quantity(item.reorder_point)}</span>,
            canManageInventory ? <Button key="actions" type="button" size="icon" variant="ghost" className="ml-auto size-8 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiveTarget({ kind: "material", id: item.id, name: item.name })} aria-label={`Archivar ${item.name}`}><Archive className="size-4" /></Button> : null,
        ]}
        renderCompactRow={(item) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.sku} · {unitLabels[item.unit]}</p></div><div className="flex shrink-0 items-center gap-1"><span className="text-xs text-[var(--text-muted)]">Mín. {quantity(item.reorder_point)}</span>{canManageInventory && <Button type="button" size="icon" variant="ghost" className="size-8 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiveTarget({ kind: "material", id: item.id, name: item.name })} aria-label={`Archivar ${item.name}`}><Archive className="size-4" /></Button>}</div></div>}
    />;

    const renderSuppliers = () => <DataListTable
        items={suppliers}
        getRowKey={(item) => item.id}
        columns={supplierColumns}
        loading={loading}
        header={{ title: "Proveedores", subtitle: "Directorio operativo independiente de los gastos ya registrados.", countLabel: `${suppliers.length} proveedores` }}
        toolbar={canManageInventory ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nombre del proveedor" aria-label="Nombre del proveedor" /><Input value={supplierEmail} onChange={(event) => setSupplierEmail(event.target.value)} type="email" placeholder="Correo opcional" aria-label="Correo del proveedor" /><Button type="button" className="sm:col-span-2 lg:col-span-1" disabled={!supplierName.trim() || saving} onClick={() => void addSupplier()}><Building2 className="size-4" />Añadir proveedor</Button></div> : undefined}
        empty={<p className="text-sm text-[var(--text-muted)]">No hay proveedores registrados.</p>}
        renderDesktopRow={(item) => [
            <div key="supplier" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.name}</p>{item.tax_id && <p className="mt-1 text-xs text-[var(--text-muted)]">{item.tax_id}</p>}</div>,
            <span key="contact" className="truncate text-sm text-[var(--text-main)]">{item.contact_name || "—"}</span>,
            <span key="email" className="truncate text-sm text-[var(--text-muted)]">{item.email || "—"}</span>,
            canManageInventory ? <Button key="actions" type="button" size="icon" variant="ghost" className="ml-auto size-8 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiveTarget({ kind: "supplier", id: item.id, name: item.name })} aria-label={`Archivar ${item.name}`}><Archive className="size-4" /></Button> : null,
        ]}
        renderCompactRow={(item) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.email || item.contact_name || "Sin contacto"}</p></div>{canManageInventory && <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiveTarget({ kind: "supplier", id: item.id, name: item.name })} aria-label={`Archivar ${item.name}`}><Archive className="size-4" /></Button>}</div>}
    />;

    const renderWarehouses = () => <DataListTable
        items={warehouses}
        getRowKey={(item) => item.id}
        columns={warehouseColumns}
        loading={loading}
        header={{ title: "Almacenes", subtitle: "Puntos de custodia de stock propios de la empresa.", countLabel: `${warehouses.length} almacenes` }}
        toolbar={canManageInventory ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><Input value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} placeholder="Nombre del almacén" aria-label="Nombre del almacén" /><Input value={warehouseAddress} onChange={(event) => setWarehouseAddress(event.target.value)} placeholder="Dirección opcional" aria-label="Dirección del almacén" /><Button type="button" className="sm:col-span-2 lg:col-span-1" disabled={!warehouseName.trim() || saving} onClick={() => void addWarehouse()}><Warehouse className="size-4" />Añadir almacén</Button></div> : undefined}
        empty={<p className="text-sm text-[var(--text-muted)]">Crea un almacén antes de registrar movimientos.</p>}
        renderDesktopRow={(item) => [<span key="warehouse" className="font-semibold text-[var(--text-main)]">{item.name}</span>, <span key="address" className="text-sm text-[var(--text-muted)]">{item.address || "—"}</span>, canManageInventory ? <Button key="actions" type="button" size="icon" variant="ghost" className="ml-auto size-8 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiveTarget({ kind: "warehouse", id: item.id, name: item.name })} aria-label={`Archivar ${item.name}`}><Archive className="size-4" /></Button> : null]}
        renderCompactRow={(item) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.name}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.address || "Sin dirección"}</p></div>{canManageInventory && <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 text-[var(--text-muted)] hover:text-destructive" onClick={() => setArchiveTarget({ kind: "warehouse", id: item.id, name: item.name })} aria-label={`Archivar ${item.name}`}><Archive className="size-4" /></Button>}</div>}
    />;

    const movementLots = lots.filter((lot) => lot.material_id === Number(movementMaterialId) && lot.warehouse_id === Number(movementWarehouseId));

    const renderMovements = () => <DataListTable
        items={movements}
        getRowKey={(item) => item.id}
        columns={movementColumns}
        loading={loading}
        header={{ title: "Libro de movimientos", subtitle: "Las entradas, salidas y ajustes se conservan como trazabilidad inmutable.", countLabel: `${movements.length} movimientos` }}
        toolbar={canManageInventory ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_7rem_minmax(10rem,1fr)_auto]"><Select value={movementMaterialId} onValueChange={(value) => { setMovementMaterialId(value); setMovementLotId("none"); }}><SelectTrigger aria-label="Material"><SelectValue placeholder="Material" /></SelectTrigger><SelectContent>{materials.map((material) => <SelectItem key={material.id} value={String(material.id)}>{material.name}</SelectItem>)}</SelectContent></Select><Select value={movementWarehouseId} onValueChange={(value) => { setMovementWarehouseId(value); setMovementLotId("none"); }}><SelectTrigger aria-label="Almacén"><SelectValue placeholder="Almacén" /></SelectTrigger><SelectContent>{warehouses.map((warehouse) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.name}</SelectItem>)}</SelectContent></Select><Select value={movementLotId} onValueChange={setMovementLotId} disabled={!movementMaterialId || !movementWarehouseId}><SelectTrigger aria-label="Lote"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin lote</SelectItem>{movementLots.map((lot) => <SelectItem key={lot.id} value={String(lot.id)}>{lot.code}</SelectItem>)}</SelectContent></Select><Select value={movementType} onValueChange={(value) => setMovementType(value as InventoryMovementType)}><SelectTrigger aria-label="Tipo de movimiento"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(movementLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Input value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} type="number" min="0.001" step="0.001" aria-label="Cantidad" /><Input value={movementReference} onChange={(event) => setMovementReference(event.target.value)} placeholder="Referencia opcional" aria-label="Referencia" /><Button type="button" disabled={!movementMaterialId || !movementWarehouseId || !movementQuantity || Number(movementQuantity) <= 0 || saving} onClick={() => void addMovement()}>{movementType === "issue" || movementType === "adjustment_out" ? <ArrowUpFromLine className="size-4" /> : <ArrowDownToLine className="size-4" />}Registrar movimiento</Button></div> : undefined}
        empty={<p className="text-sm text-[var(--text-muted)]">El primer movimiento debe ser una entrada o ajuste de entrada.</p>}
        renderDesktopRow={(item) => [
            <div key="movement" className="min-w-0"><span className={item.movement_type === "issue" || item.movement_type === "adjustment_out" ? "inline-flex rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive" : "inline-flex rounded-full bg-accent/10 px-2 py-1 text-xs font-semibold text-accent"}>{movementLabels[item.movement_type]}</span>{item.reference && <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.reference}</p>}</div>,
            <span key="material" className="truncate text-sm text-[var(--text-main)]">{item.material_name ?? materialsById.get(item.material_id)?.name ?? `Material #${item.material_id}`}</span>,
            <span key="warehouse" className="truncate text-sm text-[var(--text-main)]">{item.warehouse_name ?? warehousesById.get(item.warehouse_id)?.name ?? `Almacén #${item.warehouse_id}`}</span>,
            <span key="quantity" className="block text-right text-sm font-semibold text-[var(--text-main)]">{quantity(item.quantity)}</span>,
        ]}
        renderCompactRow={(item) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.material_name ?? materialsById.get(item.material_id)?.name ?? `Material #${item.material_id}`}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{movementLabels[item.movement_type]} · {item.warehouse_name ?? warehousesById.get(item.warehouse_id)?.name ?? "Almacén"}</p></div><span className="shrink-0 text-sm font-semibold text-[var(--text-main)]">{quantity(item.quantity)}</span></div>}
    />;

    if (userLoading || inventoryAccess === null) {
        return <div className="dashboard-page-content px-[3%] py-6 md:p-8" />;
    }

    if (!canReadInventory) {
        return <main className="dashboard-page-content px-[3%] py-6 md:p-8">
            <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center shadow-sm">
                <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
                <h1 className="mt-3 text-lg font-black text-[var(--text-main)]">Inventario restringido</h1>
                <p className="mt-2 text-sm text-[var(--text-muted)]">No tienes permisos para consultar el inventario de la empresa.</p>
            </section>
        </main>;
    }

    return <div className="dashboard-page-content px-[3%] py-6 md:p-8">
        <PageHeader icon={Boxes} title="Inventario" subtitle="Material, stock y movimientos operativos separados de gastos y activos por ubicación." className="mb-6" />
        <InventoryNavigation tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <div className="mt-5">{activeTab === "stock" ? renderStock() : activeTab === "materials" ? renderMaterials() : activeTab === "suppliers" ? renderSuppliers() : activeTab === "warehouses" ? renderWarehouses() : activeTab === "movements" ? renderMovements() : activeTab === "lots" ? <InventoryLotsSection lots={lots} loading={loading} /> : <InventoryPurchasesSection purchases={purchases} suppliers={suppliers} materials={materials} warehouses={warehouses} loading={loading} canManage={canManagePurchases} onChanged={reload} />}</div>
        <DeleteConfirmDialog open={archiveTarget !== null} onOpenChange={(open) => !open && setArchiveTarget(null)} title="Archivar registro de inventario" description="Dejará de aparecer en el catálogo operativo; el historial de movimientos se conserva." confirmText="Archivar" cancelText="Cancelar" confirmVariant="soft-danger" isDeleting={saving} onConfirm={() => void archiveCatalogEntity()} />
    </div>;
}
