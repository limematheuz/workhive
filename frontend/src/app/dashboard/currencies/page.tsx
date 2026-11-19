"use client";
import { FormSelect } from "@/components/ui/form-select";

import { useCallback, useState } from "react";
import { Coins, Plus, RefreshCw, FileText, ReceiptText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useUser } from "@/lib/user-context";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { currencyKinds, currencyMoney, currencyStatuses } from "@/lib/transaction-currency";
import { TransactionCurrencyService } from "@/services/transaction-currency.service";
import type { CurrencyKind, CurrencyRecord, CurrencyWorkspace } from "@/types/transaction-currency";
import { CurrencyDocumentDialog } from "@/components/currencies/CurrencyDocumentDialog";
import { CurrencyRecordDetail } from "@/components/currencies/CurrencyRecordDetail";

const columns: DataListColumn[] = [{ key: "document", label: "Documento" }, { key: "original", label: "Importe original" }, { key: "eur", label: "Contable EUR" }, { key: "rate", label: "Cambio / fecha" }];
const keyOf = (record: CurrencyRecord) => `${record.kind}:${record.id}`;
export default function CurrenciesPage() {
    const { user, loading } = useUser();
    const [revision, setRevision] = useState(0), [search, setSearch] = useState(""), [kind, setKind] = useState(""), [currency, setCurrency] = useState(""), [selection, setSelection] = useState("");
    const [form, setForm] = useState<{ kind: CurrencyKind; record?: CurrencyRecord } | null>(null);
    const [result, setResult] = useState<{ key: string; data: CurrencyWorkspace } | null>(null), [error, setError] = useState<{ key: string; message: string } | null>(null);
    const scope = `${user?.id}:${user?.company_id}`, key = `${scope}:${revision}`;
    const request = useCallback(() => TransactionCurrencyService.read(), []);
    useResourceEffect(Boolean(user), key, request, data => { setResult({ key, data }); setError(null); }, cause => setError({ key, message: cause instanceof Error ? cause.message : "No se pudieron cargar las operaciones." }));
    const data = result?.key === key ? result.data : null;
    const records = data?.records.filter(record => (!kind || record.kind === kind) && (!currency || record.currency_snapshot.currency === currency) && (!search.trim() || `${record.label} ${currencyKinds[record.kind]}`.toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))) ?? [];
    const selected = records.find(record => keyOf(record) === selection) ?? records[0];
    const currencies = Array.from(new Set(data?.records.map(record => record.currency_snapshot.currency))).sort();
    const refresh = () => setRevision(value => value + 1);
    if (loading) return <p role="status">Cargando…</p>;
    return <div className="dashboard-page-content space-y-4"><PageHeader title="Operaciones en moneda original" subtitle="Facturas, gastos, cobros y ventas con su cambio verificado y equivalencia contable en EUR." icon={Coins} actions={<><Button variant="outline" aria-label="Actualizar operaciones" onClick={refresh}><RefreshCw className="size-4" /></Button>{data?.can_manage && <DropdownMenu><DropdownMenuTrigger asChild><Button><Plus className="size-4" />Nueva operación</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{(Object.entries(currencyKinds) as [CurrencyKind, string][]).map(([kind, label]) => <DropdownMenuItem key={kind} onSelect={() => setForm({ kind })}>{label}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}</>} />
        {data && <SummaryMetricGrid desktopColumns={4} aria-label="Registros de la vista reciente"><SummaryMetricCard icon={Coins} label="Monedas registradas" value={String(currencies.length)} description="En los registros de esta vista" /><SummaryMetricCard icon={FileText} label="Facturas" value={String(data.records.filter(item => item.kind === "invoices").length)} description="Hasta 50 registros recientes" /><SummaryMetricCard icon={ReceiptText} label="Gastos y ventas" value={String(data.records.filter(item => ["expenses", "sales"].includes(item.kind)).length)} description="Hasta 50 registros de cada tipo" /><SummaryMetricCard icon={Wallet} label="Cobros" value={String(data.records.filter(item => item.kind === "payments").length)} description="Incluye anulados para su seguimiento" /></SummaryMetricGrid>}
        {error?.key === key && <p role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-800 dark:text-orange-300">{error.message}</p>}{!data && error?.key !== key && <p role="status" className="text-sm text-muted-foreground">Cargando documentos y tipos de cambio guardados…</p>}
        {data && <><div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3"><label className="min-w-48 flex-1 text-xs font-medium">Buscar documento<Input value={search} onChange={e => setSearch(e.target.value)} type="search" placeholder="Número, concepto o tipo" /></label><label className="text-xs font-medium">Tipo<FormSelect aria-label="Tipo de operación" className="staff-select" value={kind} onValueChange={e => setKind(e)}><option value="">Todos</option>{Object.entries(currencyKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</FormSelect></label><label className="text-xs font-medium">Moneda<FormSelect aria-label="Moneda" className="staff-select" value={currency} onValueChange={e => setCurrency(e)}><option value="">Todas</option>{currencies.map(value => <option key={value} value={value}>{value}</option>)}</FormSelect></label></div>
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(20rem,1fr)]"><DataListTable items={records} columns={columns} getRowKey={keyOf} header={{ title: "Documentos con cambio guardado", subtitle: "Hasta 50 registros recientes por tipo. El detalle conserva los importes originales.", countLabel: `${records.length} registros` }} onRowClick={record => setSelection(keyOf(record))} rowAriaLabel={record => `Ver ${currencyKinds[record.kind]} ${record.label}`} empty={<p className="p-5 text-sm text-muted-foreground">No hay operaciones con estos filtros. Registra una operación para guardar su moneda original y el cambio utilizado.</p>} renderDesktopRow={record => [<div key="document"><strong className="block break-words text-sm">{record.label}</strong><span className="mt-1 block text-xs text-muted-foreground">{currencyKinds[record.kind]} · {currencyStatuses[record.status] ?? record.status}</span></div>, <span key="original" className="text-sm font-semibold tabular-nums">{currencyMoney(record.currency_snapshot.original_amounts.total_amount, record.currency_snapshot.currency)}</span>, <span key="eur" className="text-sm tabular-nums text-muted-foreground">{currencyMoney(record.amount_eur)}</span>, <div key="rate" className="text-xs"><p>1 {record.currency_snapshot.currency} = {record.currency_snapshot.eur_rate} EUR</p><p className="mt-1 text-muted-foreground">{record.currency_snapshot.rate_date}</p></div>]} renderCompactRow={record => <div className="space-y-2"><div className="flex justify-between gap-2"><strong className="break-words text-sm">{record.label}</strong><span className="shrink-0 text-sm font-semibold">{currencyMoney(record.currency_snapshot.original_amounts.total_amount, record.currency_snapshot.currency)}</span></div><p className="text-xs text-muted-foreground">{currencyKinds[record.kind]} · {currencyStatuses[record.status] ?? record.status}</p><p className="text-xs">Contable {currencyMoney(record.amount_eur)} · cambio del {record.currency_snapshot.rate_date}</p></div>} />{selected && <CurrencyRecordDetail key={`${scope}:${keyOf(selected)}:${revision}`} record={selected} canManage={data.can_manage} edit={() => setForm({ kind: selected.kind, record: selected })} refresh={refresh} />}</div>
            <p className="text-xs leading-5 text-muted-foreground">Los documentos históricos sin moneda original guardada conservan sus importes en EUR en sus fichas habituales. Los indicadores de esta pantalla corresponden a los registros recientes cargados.</p>
            {form && data.can_manage && <CurrencyDocumentDialog key={`${scope}:${form.kind}:${form.record?.id ?? "new"}`} {...form} options={data} close={() => setForm(null)} saved={record => { setSelection(keyOf(record)); setForm(null); setKind(""); setCurrency(""); setSearch(""); refresh(); }} />}
        </>}
    </div>;
}
