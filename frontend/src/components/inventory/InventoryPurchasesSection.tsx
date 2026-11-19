"use client";

import { useCallback, useState, type FormEvent } from "react";
import { CircleDollarSign, Loader2, RotateCcw } from "lucide-react";

import { purchaseApprovalWorkspace } from "@/services/workflow-approval.service";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useUser } from "@/lib/user-context";
import { InventoryPurchaseDialog } from "./InventoryPurchaseDialog";
import {PurchaseApprovalPanel} from "./PurchaseApprovalPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/toast";
import { InventoryService } from "@/services/inventory.service";
import type { InventoryMaterial, InventoryPurchase, InventorySupplier, InventoryWarehouse } from "@/types/inventory";

type InventoryPurchasesSectionProps = {
    purchases: InventoryPurchase[];
    suppliers: InventorySupplier[];
    materials: InventoryMaterial[];
    warehouses: InventoryWarehouse[];
    loading: boolean;
    canManage: boolean;
    canPropose: boolean;
    sourceRequestId?: number | null;
    focusPurchaseId?: number | null;
    focusApprovalId?: number | null;
    onChanged: () => Promise<void>;
};

const purchaseColumns: DataListColumn[] = [
    { key: "supplier", label: "Proveedor", className: "w-[24%]" },
    { key: "description", label: "Compra" },
    { key: "date", label: "Fecha", className: "w-32" },
    { key: "total", label: "Total", className: "w-28 text-right" },
    { key: "status", label: "Estado", className: "w-24 text-right" },
    { key: "actions", label: "Acciones", className: "w-32 text-right" },
];

function PurchaseStatus({ status }: { status: InventoryPurchase["status"] }) {
    return <Badge variant="outline" className={status === "received"
        ? "border-accent/25 bg-accent/10 text-accent"
        : "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}>
        {status === "received" ? "Recibida" : "Corregida"}
    </Badge>;
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

function formatDate(value: string) {
    return dateFormatter.format(new Date(value));
}

function PurchaseCorrectionDialog({
    purchase,
    isSubmitting,
    onOpenChange,
    onConfirm,
}: {
    purchase: InventoryPurchase | null;
    isSubmitting: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (purchase: InventoryPurchase, reason: string) => Promise<boolean>;
}) {
    const [reason, setReason] = useState("");

    const close = () => {
        setReason("");
        onOpenChange(false);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!purchase || !reason.trim()) return;
        if (await onConfirm(purchase, reason.trim())) close();
    };

    return (
        <Dialog open={purchase !== null} onOpenChange={(open) => !open && close()}>
            <DialogContent compact>
                <DialogHeader>
                    <DialogTitle>Corregir compra</DialogTitle>
                    <DialogDescription>Generará un ajuste de salida y anulará el gasto asociado; el historial de la compra se conserva.</DialogDescription>
                </DialogHeader>
                <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
                    <div className="grid gap-2">
                        <Label htmlFor="inventory-purchase-correction-reason">Motivo de la corrección</Label>
                        <Textarea id="inventory-purchase-correction-reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe el motivo de la corrección" rows={3} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="cancel" disabled={isSubmitting}>Cancelar</Button></DialogClose>
                        <Button type="submit" disabled={!reason.trim() || isSubmitting}>{isSubmitting && <Loader2 className="size-4 animate-spin" />}Corregir compra</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function InventoryPurchasesSection({ purchases, suppliers, materials, warehouses, loading, canManage, canPropose, sourceRequestId, focusPurchaseId, focusApprovalId, onChanged }: InventoryPurchasesSectionProps) {
    const { user } = useUser();
    const [manualDialogOpen, setManualDialogOpen] = useState(false), [handledRequest, setHandledRequest] = useState<number | null>(null);
    const [approvalRevision, setApprovalRevision] = useState(0);
    const [workspace, setWorkspace] = useState<{ key: string; data: Awaited<ReturnType<typeof purchaseApprovalWorkspace>> } | null>(null);
    const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
    const approvalKey = `${user?.company_id}:${user?.id}:${approvalRevision}`;
    const request = useCallback(() => purchaseApprovalWorkspace(), []);
    useResourceEffect(Boolean(user), approvalKey, request, data => { setWorkspace({ key: approvalKey, data }); setFailed(null); }, error => setFailed({ key: approvalKey, message: getErrorMessage(error, "No se pudo comprobar la política de aprobación.") }));
    const data = workspace?.key === approvalKey ? workspace.data : null;
    const approval = data?.policy;
    const budgets = data?.budgets ?? [];
    const missingCatalog = !suppliers.length || !materials.length || !warehouses.length;
    const approvalBlocked = Boolean(approval && !approval.available && (approval.purchases_required || !canManage));
    const canCreate = canPropose && Boolean(approval) && !approvalBlocked && !missingCatalog;
    const initialSource = sourceRequestId !== handledRequest && canCreate ? budgets.find(item => item.id === sourceRequestId) : null;
    const dialogOpen = manualDialogOpen || Boolean(initialSource);
    const focusedPurchase = purchases.find(item => item.id === focusPurchaseId);
    const closeDialog = (open: boolean) => { setManualDialogOpen(open); if (!open && sourceRequestId) setHandledRequest(sourceRequestId); };
    const [reversingId, setReversingId] = useState<number | null>(null);
    const [purchaseToCorrect, setPurchaseToCorrect] = useState<InventoryPurchase | null>(null);

    const reverse = async (purchase: InventoryPurchase, reason: string) => {
        setReversingId(purchase.id);
        try {
            await InventoryService.reversePurchase(purchase.id, reason);
            toast.success("Compra corregida mediante ajuste de stock.");
            await onChanged();
            return true;
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo corregir la compra."));
            return false;
        } finally {
            setReversingId(null);
        }
    };

    return <>
        <DataListTable
            items={purchases}
            getRowKey={(purchase) => purchase.id}
            columns={purchaseColumns}
            desktopFrom="lg"
            loading={loading}
            header={{ title: "Compras de material", subtitle: "Cada compra enlaza un gasto fiscal con entradas de stock inmutables.", countLabel: `${purchases.length} compras` }}
            toolbar={canPropose ? <div className="space-y-2"><div className="flex justify-end"><Button type="button" disabled={!canCreate} onClick={() => setManualDialogOpen(true)}><CircleDollarSign className="size-4" />Nueva compra</Button></div>{missingCatalog && <p className="text-xs text-orange-700">Completa proveedores, materiales y almacenes antes de preparar una compra.</p>}{approvalBlocked && <p role="alert" className="text-sm text-orange-700">Se necesita aprobación para registrar esta compra, pero el módulo no está disponible en el plan actual. Revisa la configuración con el administrador.</p>}</div> : undefined}
            empty={<p className="text-sm text-[var(--text-muted)]">Registra una compra cuando recibas material y su gasto asociado.</p>}
            renderDesktopRow={(purchase) => [
                <div key="supplier" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{purchase.supplier_name_snapshot}</p>{purchase.supplier_tax_id_snapshot && <p className="mt-1 text-xs text-[var(--text-muted)]">{purchase.supplier_tax_id_snapshot}</p>}</div>,
                <div key="description" className="min-w-0"><p className="truncate text-sm text-[var(--text-main)]">{purchase.expense.description}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{purchase.lines.length} {purchase.lines.length === 1 ? "línea" : "líneas"}{purchase.reference ? ` · ${purchase.reference}` : ""}</p></div>,
                <span key="date" className="text-sm text-[var(--text-muted)]">{formatDate(purchase.expense.expense_date)}</span>,
                <span key="total" className="block text-right text-sm font-semibold text-[var(--text-main)]">{formatCurrency(purchase.expense.total_amount)}</span>,
                <div key="status" className="flex justify-end"><PurchaseStatus status={purchase.status} /></div>,
                <div key="actions" className="flex justify-end">{canManage && purchase.status === "received" && <Button type="button" size="sm" variant="outline" disabled={reversingId === purchase.id} onClick={() => setPurchaseToCorrect(purchase)}>{reversingId === purchase.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}Corregir</Button>}</div>,
            ]}
            renderCompactRow={(purchase) => <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{purchase.supplier_name_snapshot}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{purchase.expense.description} · {formatDate(purchase.expense.expense_date)}</p><div className="mt-2"><PurchaseStatus status={purchase.status} /></div></div><div className="flex shrink-0 flex-col items-end gap-2"><span className="font-semibold text-[var(--text-main)]">{formatCurrency(purchase.expense.total_amount)}</span>{canManage && purchase.status === "received" && <Button type="button" size="sm" variant="outline" disabled={reversingId === purchase.id} onClick={() => setPurchaseToCorrect(purchase)}><RotateCcw className="size-4" />Corregir</Button>}</div></div>}
        />
        {focusedPurchase && <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm"><strong>Compra #{focusedPurchase.id} · {focusedPurchase.expense.description}</strong><p className="mt-1 text-muted-foreground">{focusedPurchase.supplier_name_snapshot} · {formatCurrency(focusedPurchase.expense.total_amount)} · gasto #{focusedPurchase.expense_id}</p></div>}
        {sourceRequestId && data && approval?.available && !budgets.some(item => item.id === sourceRequestId) && <p className="mt-3 text-sm text-orange-700">La autorización solicitada ya no está disponible para una nueva compra. Puede estar vinculada a una propuesta o compra registrada; revisa su estado en Solicitudes internas.</p>}
        {failed?.key === approvalKey && <p role="alert" className="mt-3 text-sm text-orange-700">{failed.message}<Button size="sm" variant="outline" className="ml-3" onClick={() => setApprovalRevision(value => value + 1)}>Reintentar</Button></p>}
        {approval?.available && <PurchaseApprovalPanel revision={approvalRevision} canManage={canManage} suppliers={suppliers} materials={materials} warehouses={warehouses} focusId={focusApprovalId} changed={() => { void onChanged(); setApprovalRevision(value => value + 1); }} />}
        {dialogOpen && approval && canCreate && <InventoryPurchaseDialog key={initialSource?.id ?? "manual"} policy={approval} canRecord={canManage} budgets={budgets} initialSource={initialSource} open onOpenChange={closeDialog} suppliers={suppliers} materials={materials} warehouses={warehouses} onCreated={async () => { await onChanged(); setApprovalRevision(value => value + 1); }} />}
        <PurchaseCorrectionDialog purchase={purchaseToCorrect} isSubmitting={reversingId === purchaseToCorrect?.id} onOpenChange={(open) => !open && setPurchaseToCorrect(null)} onConfirm={reverse} />
    </>;
}
