"use client";
import { useCallback, useState } from "react";
import { Landmark, FileSpreadsheet, UsersRound, MessageSquare, RefreshCw, LayoutDashboard, ArrowUpRight } from "lucide-react";
import { AccountingPeriodControl } from "@/components/operations/AccountingPeriodControl";
import { AdvisoryAccounting } from "@/components/operations/AdvisoryAccounting";
import { LaborCommunicationsPanel } from "./LaborCommunicationsPanel";
import { AdvisoryRequests } from "@/components/operations/AdvisoryRequests";
import { AdvisoryGrantSettings } from "@/components/organization/AdvisoryGrantSettings";
import { AdvisoryPayrollDetails } from "./AdvisoryPayrollDetails";
import { canManageFinance, canManageLaborCosts } from "@/domain/access/roles";
import { PageHeader } from "@/components/ui/page-header";
import { DatePicker } from "@/components/ui/date-picker";
import { AdvisoryAttentionOverview } from "./AdvisoryAttentionOverview";
import { Button } from "@/components/ui/button";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useUser } from "@/lib/user-context";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { readAdvisory, advisoryExportHref, type AdvisoryCompany, type Payroll } from "@/services/advisory.service";

type Tab = "overview" | "accounting" | "payroll" | "requests";
export function AdvisoryWorkspace() {
    const { user, loading } = useUser();
    const [revision, setRevision] = useState(0), [selected, setSelected] = useState("");
    const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [tab, setTab] = useState<Tab>("overview");
    const [requestFilter,setRequestFilter]=useState<"pending"|"answered">("pending");
    const [result, setResult] = useState<{ key: string; rows: AdvisoryCompany[] } | null>(null);
    const [payroll, setPayroll] = useState<{ key: string; data: Payroll } | null>(null);
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const scope = `${user?.company_id}:${user?.id}`, key = `${scope}:${revision}`;
    const request = useCallback(() => readAdvisory<AdvisoryCompany[]>("companies"), []);
    useResourceEffect(Boolean(user), key, request, rows => { setResult({ key, rows }); setError(""); }, reason => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las empresas autorizadas."));
    const companies = result?.key === key ? result.rows : [];
    const company = companies.find(item => String(item.id) === selected) ?? companies[0];
    const payrollKey = `${scope}:${company?.id}:${month}`;
    const data = payroll?.key === payrollKey ? payroll.data : null;
    const tabs = [{ id: "overview" as const, label: "Resumen", icon: LayoutDashboard }, ...(company?.accounting ? [{ id: "accounting" as const, label: "Contabilidad", icon: FileSpreadsheet }] : []), ...(company?.payroll ? [{ id: "payroll" as const, label: "Laboral", icon: UsersRound }] : []), ...(company ? [{ id: "requests" as const, label: "Información pendiente", icon: MessageSquare }] : [])];
    const activeTab = tabs.some(item => item.id === tab) ? tab : "overview";
    async function openPayroll() {
        if (!company?.payroll || !month) return;
        setTab("payroll"); setBusy(true); setError(""); setPayroll(null);
        try { const value = await readAdvisory<Payroll>(`${company.id}/payroll?month=${month}`); setPayroll({ key: payrollKey, data: value }); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo consultar el área laboral."); }
        finally { setBusy(false); }
    }
    if (loading) return <p role="status">Cargando gestoría…</p>;
    return <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-6">
        <PageHeader icon={Landmark} title="Portal de gestoría" subtitle="Contabilidad, gestión laboral y documentación de las empresas que te han autorizado." actions={<Button variant="outline" disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw className="size-4" />Actualizar</Button>} />
        {user?.role.name === "admin" && <section className="space-y-2"><h2 className="text-sm font-semibold">Autorizaciones de tu gestoría</h2><AdvisoryGrantSettings /></section>}
        {error && <p role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">{error}</p>}
        {result?.key !== key && !error && <p role="status" className="text-sm text-muted-foreground">Cargando empresas autorizadas…</p>}
        {result?.key === key && !companies.length && <section className="rounded-2xl border bg-card p-8"><h2 className="font-semibold">No tienes empresas autorizadas</h2><p className="mt-2 text-sm text-muted-foreground">La empresa debe autorizar esta cuenta y activar el área contable, laboral o ambas. Cada autorización se puede revocar de forma independiente.</p></section>}
        {company && <><section className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-4"><div className="min-w-56 flex-1"><label htmlFor="advisory-company" className="mb-1 block text-sm font-medium">Empresa autorizada</label><SearchableSelect id="advisory-company" aria-label="Empresa autorizada" value={String(company.id)} options={companies.map(item => ({ value: String(item.id), label: item.name, description: [item.accounting && "Contabilidad", item.payroll && "Laboral"].filter(Boolean).join(" · ") }))} onValueChange={value => { setSelected(value); setPayroll(null); setError(""); }} disabled={busy} required /></div>{(activeTab === "accounting" || activeTab === "payroll") && <label className="w-full text-sm font-medium sm:w-44" htmlFor="advisory-month">{activeTab === "accounting" ? "Periodo contable" : "Periodo laboral"}<DatePicker id="advisory-month" aria-label="Periodo de gestoría" disabled={busy} value={month?month+"-01":""} onValueChange={value=>{if(value)setMonth(value.slice(0,7));setPayroll(null);}}/></label>}<div className="flex flex-wrap gap-2 text-xs">{company.accounting && <span className="rounded-full bg-accent/10 px-3 py-2 text-accent">Contabilidad autorizada</span>}{company.payroll && <span className="rounded-full bg-accent/10 px-3 py-2 text-accent">Laboral autorizado</span>}</div></section>
            <PremiumTabs tabs={tabs} activeTab={activeTab} onChange={next => { setTab(next); if (next === "payroll" && !data) void openPayroll(); }} mobileLabel="Sección de gestoría" />
            {activeTab === "overview" && <><AdvisoryAttentionOverview key={company.id} company={company.id} external={user?.role.name==="external_portal"} canReply={canManageFinance(user) || canManageLaborCosts(user)} onOpen={filter=>{setRequestFilter(filter);setTab("requests");}}/><div className={`grid gap-4 ${company.accounting && company.payroll ? "md:grid-cols-2" : ""}`}>{company.accounting && <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Contabilidad y fiscalidad</h2><p className="text-sm leading-6 text-muted-foreground">Consulta facturas, gastos y justificantes reales, exporta el libro y revisa el cierre de los periodos autorizados.</p><Button variant="outline" onClick={() => setTab("accounting")}>Abrir contabilidad<ArrowUpRight className="size-4" /></Button></section>}{company.payroll && <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">Gestión laboral</h2><p className="text-sm leading-6 text-muted-foreground">Revisa trabajadores, documentación, horas aprobadas, ausencias y variables del periodo; entrega las nóminas a cada persona.</p><Button variant="outline" disabled={busy} onClick={() => void openPayroll()}>Abrir área laboral<ArrowUpRight className="size-4" /></Button></section>}</div></>}
            {activeTab === "accounting" && company.accounting && month && <section className="space-y-4"><Button variant="outline" asChild><a href={advisoryExportHref(company.id, Number(month.slice(0, 4)))} download>Descargar contabilidad anual</a></Button><AccountingPeriodControl key={`period:${company.id}:${month}`} company={company.id} month={month} /><AdvisoryAccounting key={`${company.id}:${month}`} company={company.id} month={month} /></section>}
            {activeTab === "payroll" && company.payroll && <section className="space-y-4"><LaborCommunicationsPanel key={company.id} company={company.id} /><div className="flex flex-wrap gap-2"><Button disabled={busy || !month} onClick={() => void openPayroll()}>{busy ? "Consultando…" : "Actualizar laboral del periodo"}</Button>{month && <Button variant="outline" asChild><a href={advisoryExportHref(company.id, Number(month.slice(0, 4)), month)} download>Descargar horas aprobadas</a></Button>}</div>{data && <AdvisoryPayrollDetails data={data} company={company.id} month={month} canDeliver={user?.role.name === "external_portal" || canManageLaborCosts(user)} delivered={() => void openPayroll()} />}</section>}
            {activeTab === "requests" && <AdvisoryRequests initialFilter={requestFilter} key={company.id} company={company.id} external={user?.role.name === "external_portal"} accounting={company.accounting} payroll={company.payroll} canReply={canManageFinance(user) || canManageLaborCosts(user)} />}
        </>}
    </div>;
}
