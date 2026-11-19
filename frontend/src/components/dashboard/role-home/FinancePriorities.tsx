"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { ClipboardList, Clock3, FileText, RefreshCw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { useWorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigationProvider";
import { useUser } from "@/lib/user-context";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { canManageFinance } from "@/domain/access/roles";
import { financeLocalDay, invoiceOutstandingCents, isInvoiceOverdue } from "@/lib/finance-priorities";
import { FinancePrioritiesService, type FinancePrioritiesSnapshot } from "@/services/finance-priorities.service";

type View = "jobs" | "overdue" | "quotes";
type Row = { id: number; title: string; detail: string; amount: string; date: string; href: string };
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const calendar = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const columns: DataListColumn[] = [{ key: "document", label: "Trabajo / documento" }, { key: "date", label: "Fecha" }, { key: "amount", label: "Importe EUR" }, { key: "action", label: "Acción" }];
const viewTitles = { jobs: "Trabajos terminados pendientes de facturar", overdue: "Facturas vencidas con saldo pendiente", quotes: "Presupuestos enviados pendientes de respuesta" };
function date(value?: string | null) { const parsed = value ? new Date(value) : null; return parsed && Number.isFinite(parsed.getTime()) ? calendar.format(parsed) : "Sin fecha registrada"; }

export function FinancePriorities() {
    const { user } = useUser(), access = useWorkspaceNavigation();
    const canPrepare = canManageFinance(user);
    const invoices = access.navigation.visibleNavLinks.some(link => link.href === "/dashboard/invoices"), quotes = access.navigation.visibleNavLinks.some(link => link.href === "/dashboard/quotes");
    const [revision, setRevision] = useState(0), [selection, setSelection] = useState<View>("jobs");
    const [result, setResult] = useState<{ key: string; data: FinancePrioritiesSnapshot } | null>(null), [error, setError] = useState("");
    const key = `${user?.id}:${user?.company_id}:${invoices}:${quotes}:${revision}`;
    const request = useCallback(() => FinancePrioritiesService.read({ invoices, quotes }), [invoices, quotes]);
    useResourceEffect(Boolean(user && !access.loading && (invoices || quotes)), key, request, data => { setResult({ key, data }); setError(""); }, reason => setError(reason instanceof Error ? reason.message : "No se pudieron consultar las prioridades financieras."));
    const data = result?.key === key ? result.data : null;
    const active = !invoices && selection !== "quotes" ? "quotes" : !quotes && selection === "quotes" ? "jobs" : selection;
    const overdue = data?.invoices.filter(row => isInvoiceOverdue(row, financeLocalDay(new Date(data.asOf)))) ?? [];
    const balance = overdue.reduce((sum, row) => sum + invoiceOutstandingCents(row), 0) / 100;
    const rows: Row[] = !data ? [] : active === "jobs" ? data.jobs.map(row => ({ id: row.id, title: row.title, detail: `${row.client_name} · ${row.location_name}`, amount: "Por facturar", date: date(row.date_done), href: canPrepare ? "/dashboard/invoices?view=jobs" : "/dashboard/invoices" })) : active === "overdue" ? overdue.map(row => ({ id: row.id, title: row.invoice_number, detail: "Saldo pendiente de cobro", amount: money.format(invoiceOutstandingCents(row) / 100), date: date(row.due_date), href: `/dashboard/invoices/${row.id}` })) : data.quotes.map(row => ({ id: row.id, title: row.quote_number, detail: row.title, amount: money.format(Number(row.total_amount)), date: row.valid_until ? date(row.valid_until) : "Sin caducidad", href: `/dashboard/quotes/${row.id}` }));
    return <section className="space-y-5"><PageHeader icon={Wallet} title="Prioridades de facturación" subtitle="Pendientes actuales de tu empresa. Importes contables en EUR; trabajos y documentos reales." actions={<Button variant="outline" disabled={!data && !error} onClick={() => setRevision(value => value + 1)}><RefreshCw className="size-4" />Actualizar</Button>} />
        {error && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-sm text-orange-700 dark:text-orange-300">{error}<Button className="ml-3" size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>Reintentar</Button></div>}
        {access.loading || (!data && !error && (invoices || quotes)) ? <p role="status" className="text-sm text-muted-foreground">Consultando pendientes autorizados…</p> : !invoices && !quotes ? <p className="rounded-xl border p-4 text-sm text-muted-foreground">No hay módulos financieros habilitados para esta cuenta en la empresa activa.</p> : null}
        {data && <><p className="text-xs text-muted-foreground">Actualizado el {data.asOfLabel}. Selecciona una tarjeta para revisar sus registros.</p><SummaryMetricGrid desktopColumns={3}>{invoices && <button type="button" className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Pendientes de facturar" aria-pressed={active === "jobs"} onClick={() => setSelection("jobs")}><SummaryMetricCard icon={ClipboardList} label="Pendientes de facturar" value={String(data.jobs.length)} description="Trabajos finalizados · acumulado actual" className={active === "jobs" ? "ring-1 ring-accent" : ""} /></button>}{invoices && <button type="button" className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Facturas vencidas" aria-pressed={active === "overdue"} onClick={() => setSelection("overdue")}><SummaryMetricCard icon={Clock3} label="Facturas vencidas" value={money.format(balance)} description={`${overdue.length} facturas · saldo pendiente actual`} valueTone={overdue.length ? "negative" : "default"} className={active === "overdue" ? "ring-1 ring-accent" : ""} /></button>}{quotes && <button type="button" className="rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label="Presupuestos enviados" aria-pressed={active === "quotes"} onClick={() => setSelection("quotes")}><SummaryMetricCard icon={FileText} label="Presupuestos enviados" value={String(data.quotes.length)} description={`${money.format(data.quotes.reduce((sum, row) => sum + Math.round(Number(row.total_amount) * 100), 0) / 100)} · total enviado`} className={active === "quotes" ? "ring-1 ring-accent" : ""} /></button>}</SummaryMetricGrid><DataListTable key={active} items={rows} columns={columns} getRowKey={row => row.id} header={{ title: viewTitles[active], countLabel: `${rows.length} registros` }} empty={<p className="p-4 text-sm text-muted-foreground">No hay registros pendientes en esta vista.</p>} renderDesktopRow={row => [<div key="title"><strong className="text-sm">{row.title}</strong><p className="mt-1 text-xs text-muted-foreground">{row.detail}</p></div>, <span key="date" className="text-sm">{row.date}</span>, <span key="amount" className="text-sm font-medium">{row.amount}</span>, <Button key="action" variant="outline" size="sm" asChild><Link href={row.href}>{active === "jobs" ? canPrepare ? "Preparar factura" : "Ver facturas" : "Abrir documento"}</Link></Button>]} renderCompactRow={row => <div className="space-y-2"><strong className="text-sm">{row.title}</strong><p className="text-xs text-muted-foreground">{row.detail} · {row.date}</p><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{row.amount}</span><Button variant="outline" size="sm" asChild><Link href={row.href}>{active === "jobs" ? canPrepare ? "Preparar factura" : "Ver facturas" : "Abrir documento"}</Link></Button></div></div>} /></>}
    </section>;
}
