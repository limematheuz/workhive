"use client";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { SubcontractForm } from "@/components/operations/SubcontractForm";
import { useUser } from "@/lib/user-context";
import { canManageFinance } from "@/domain/access/roles";
import { InventoryService } from "@/services/inventory.service";
import { WorkOrderService } from "@/services/work-order.service";
import { subcontractRequest, type Subcontract } from "@/services/subcontract.service";
import type { WorkOrder } from "@/types/work-order";
import type { InventorySupplier } from "@/types/inventory";
const labels = { planned: "Preparación", progress: "En ejecución", completed: "Validada", cancelled: "Cancelada" };
export default function SubcontractsPage() {
    const { user } = useUser();
    const manage = canManageFinance(user);
    const [items, setItems] = useState<Subcontract[]>([]), [orders, setOrders] = useState<WorkOrder[]>([]), [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
    const [edit, setEdit] = useState<Subcontract | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [formVersion, setFormVersion] = useState(0), [today, setToday] = useState("");
    const request = useCallback(() => Promise.all([subcontractRequest<Subcontract[]>(), WorkOrderService.getWorkOrders(), InventoryService.getSuppliers()]), []);
    const receive = useCallback(([rows, work, supply]: Awaited<ReturnType<typeof request>>) => { setItems(rows); setOrders(work); setSuppliers(supply); setToday(new Date().toISOString().slice(0, 10)); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudo cargar."), []);
    async function load() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(Boolean(user), `${user?.company_id}:${user?.id}`, request, receive, failed);
    async function review(id: number, status: string) { setBusy(true); try {
        await subcontractRequest("/" + id + "/review", { status });
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo validar.");
    }
    finally {
        setBusy(false);
    } }
    return <div className="dashboard-page-content space-y-4"><PageHeader icon={Building2} title="Subcontratas" subtitle="Documentación, ejecución y costes de empresas proveedoras por orden." actions={<Link className="text-sm underline" href="/dashboard/inventory">Gestionar proveedores</Link>}/>
 {error && <p role="alert" className="text-orange-700">{error}</p>}
 {manage && <SubcontractForm key={edit?.id ?? "new-" + formVersion} item={edit} orders={orders} suppliers={suppliers} saved={() => { setEdit(null); setFormVersion(v => v + 1); void load(); }}/>}
 <section className="divide-y rounded-xl border">{!items.length && <p className="p-4 text-sm text-muted-foreground">No hay servicios subcontratados registrados.</p>}{items.map(item => <article key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div><p className="font-semibold">{item.supplier} · {item.description}</p><Link className="text-sm underline" href="/dashboard/work-orders">{item.work_order}</Link><p className="text-sm">{labels[item.status]} · {item.amount} €</p><p className={!item.document_url || !item.document_expires_on || (today && item.document_expires_on < today) ? "text-sm text-orange-700" : "text-sm"}>{item.document_url ? <a href={item.document_url} target="_blank" rel="noreferrer" className="underline">Documentación</a> : "Documentación pendiente"} · {item.document_expires_on ?? "Caducidad pendiente"}</p>{item.expense_id && <Link className="text-sm underline" href="/dashboard/expenses">Ver gasto #{item.expense_id}</Link>}</div>
 {manage && item.status !== "completed" && item.status !== "cancelled" && <div className="flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => setEdit(item)}>Editar</Button>{item.status === "planned" && <Button disabled={busy} variant="outline" onClick={() => void review(item.id, "progress")}>Iniciar</Button>}<Button disabled={busy} onClick={() => void review(item.id, "completed")}>Validar servicio y registrar coste</Button><Button disabled={busy} variant="outline" onClick={() => void review(item.id, "cancelled")}>Cancelar</Button></div>}</article>)}</section></div>;
}
