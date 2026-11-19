"use client";
import {Checkbox} from "@/components/ui/checkbox";
import {FormSelect} from "@/components/ui/form-select";
import { useEffect, useMemo, useState } from "react";
import { FileChartColumn } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { ReportResults } from "@/components/operations/ReportResults";
import { useUser } from "@/lib/user-context";
import { canViewLaborCosts, canViewQuality } from "@/domain/access/roles";
import { LocationService, type Location } from "@/services/location.service";
import { reportRequest, reportColumns, reportExportHref, type SavedReport, type ReportInput, type ReportKind, type ReportResult } from "@/services/custom-report.service";
export default function CustomReportsPage() {
    const { user } = useUser();
    const [draft, setDraft] = useState<ReportInput>(() => ({ name: "Mi informe", kind: "work", columns: ["id", "title", "location", "status"], starts_on: new Date().toISOString().slice(0, 8) + "01", ends_on: new Date().toISOString().slice(0, 10), location_id: null }));
    const [saved, setSaved] = useState<SavedReport[]>([]), [sites, setSites] = useState<Location[]>([]), [data, setData] = useState<ReportResult | null>(null);
    const [current, setCurrent] = useState<ReportInput | null>(null), [savedId, setSavedId] = useState<number | null>(null), [offset, setOffset] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState("");
    useEffect(() => { let active = true; if (user)
        Promise.all([reportRequest<SavedReport[]>(), LocationService.getLocations()]).then(([reports, locations]) => { if (active) {
            setSaved(reports);
            setSites(locations);
        } }).catch(e => { if (active)
            setError(e.message); }); return () => { active = false; }; }, [user]);
    async function run(input: ReportInput, start = 0, id: number | null = null) { setBusy(true); setError(""); try {
        const result = await reportRequest<ReportResult>("/run?offset=" + start, input);
        setData(result);
        setCurrent(input);
        setOffset(start);
        setSavedId(id);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo consultar.");
    }
    finally {
        setBusy(false);
    } }
    async function save() { setBusy(true); setError(""); try {
        const report = await reportRequest<SavedReport>("", draft);
        setSaved(rows => [...rows, report]);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
    finally {
        setBusy(false);
    } }
    async function remove(id: number) { setBusy(true); try {
        await reportRequest("/" + id, undefined, "DELETE");
        setSaved(rows => rows.filter(r => r.id !== id));
        if (savedId === id)
            setSavedId(null);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
    finally {
        setBusy(false);
    } }
    const options: ReportKind[] = ["work", ...(canViewLaborCosts(user) ? ["staff" as const] : []), ...(canViewQuality(user) ? ["quality" as const] : [])];
    const selectedColumns = useMemo(() => new Set(draft.columns), [draft.columns]);
    return <div className="dashboard-page-content space-y-4"><PageHeader icon={FileChartColumn} title="Informes personalizados" subtitle="Elige datos, periodo y columnas. Guarda tus consultas y exporta cada página del resultado."/>
 {error && <p role="alert" className="text-orange-700">{error}</p>}
 <form className="rounded-xl border p-4" onSubmit={e => { e.preventDefault(); void run(draft); }}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Nombre<Input required value={draft.name} maxLength={120} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label><label className="text-sm">Datos<FormSelect aria-label={"Datos"}  value={draft.kind} onValueChange={selectedOptionValue=>{ const kind = selectedOptionValue as ReportKind; setDraft({ ...draft, kind, location_id: null, columns: Object.keys(reportColumns[kind]).slice(0, 4) }); }}>{options.map(kind => <option key={kind} value={kind}>{kind === "work" ? "Trabajos" : kind === "staff" ? "Personal" : "Incidencias de calidad"}</option>)}</FormSelect></label>
 <label className="text-sm">Ubicación<FormSelect aria-label={"Ubicación"} disabled={draft.kind === "staff"}  value={draft.location_id ?? ""} onValueChange={selectedOptionValue=>setDraft({ ...draft, location_id: selectedOptionValue ? Number(selectedOptionValue) : null })}><option value="">Todas las autorizadas</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</FormSelect></label>
 <label className="text-sm">Desde<DatePicker disabled={draft.kind === "staff"} aria-label="Inicio del informe" value={draft.starts_on} onValueChange={v => setDraft({ ...draft, starts_on: v })}/></label><label className="text-sm">Hasta<DatePicker disabled={draft.kind === "staff"} aria-label="Fin del informe" min={draft.starts_on} value={draft.ends_on} onValueChange={v => setDraft({ ...draft, ends_on: v })}/></label><p className="self-end text-xs text-muted-foreground">{draft.kind === "staff" ? "Plantilla actual de la empresa." : "Trabajos por fecha programada e incidencias por fecha de creación."}</p>
 <fieldset className="flex flex-wrap gap-3 sm:col-span-3"><legend className="mb-2 text-sm">Columnas</legend>{Object.entries(reportColumns[draft.kind]).map(([key, label]) => <label key={key} className="flex items-center gap-1 text-sm"><Checkbox checked={selectedColumns.has(key)} onCheckedChange={checked => setDraft({ ...draft, columns: checked === true ? [...draft.columns, key] : draft.columns.filter(c => c !== key) })}/>{label}</label>)}</fieldset><div className="flex gap-2 sm:col-span-3"><Button disabled={!draft.columns.length}>Consultar</Button><Button variant="outline" type="button" disabled={!draft.columns.length} onClick={() => void save()}>Guardar consulta</Button></div></fieldset></form>
 <section className="flex flex-wrap items-center gap-2 rounded-xl border p-3"><h2 className="w-full text-sm font-semibold">Mis consultas guardadas</h2>{saved.map(report => <div key={report.id} className="flex gap-1"><Button variant="outline" disabled={busy} onClick={() => { setDraft(report); void run(report, 0, report.id); }}>{report.name}</Button><Button variant="ghost" disabled={busy} aria-label={"Eliminar informe " + report.name} onClick={() => void remove(report.id)}>×</Button></div>)}</section>
 {data && <><ReportResults data={data} offset={offset} busy={busy} page={start => { if (current)
        void run(current, start, savedId); }}/>{savedId && <a className="inline-flex rounded-lg border px-3 py-2 text-sm underline" href={reportExportHref(savedId, offset)} download>Exportar esta página a CSV</a>}</>}
 </div>;
}
