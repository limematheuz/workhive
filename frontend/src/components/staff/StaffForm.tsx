import { createClientId } from "@/lib/editable-line-key";
import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StaffAvailabilityFields } from "./StaffAvailabilityFields";
import { QUALIFICATIONS, type QualificationCode } from "@/domain/staff/staff-availability";
import { costLabels, StaffService, type CostKey, type Employee, type Profile, type StaffDocument } from "@/services/staff.service";
type StaffDraft = Omit<Employee, "profile"> & { profile: Omit<Profile, "documents"> & { documents: (StaffDocument & { _key: string })[] } };
export function StaffForm({ worker, close, saved }: {
    worker: Employee;
    close: () => void;
    saved: (e: Employee) => void;
}) {
    const [draft, setDraft] = useState<StaffDraft>(() => ({ ...worker, profile: { ...worker.profile, weekly_availability: worker.profile.weekly_availability?.map(row => ({ ...row, _key: createClientId() })) ?? null, documents: worker.profile.documents.map(d => ({ ...d, _key: createClientId() })) } }));
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    function profile(key: string, value: string) { setDraft({ ...draft, profile: { ...draft.profile, [key]: value } }); }
    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            saved(await StaffService.save({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.map(({ _key, ...document }) => { void _key; return document; }) } }));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Error al guardar");
        }
        finally {
            setBusy(false);
        }
    }
    return <Dialog open onOpenChange={open => { if (!open)
        close(); }}><DialogContent className="max-h-[88dvh] overflow-y-auto"><DialogHeader><DialogTitle>{worker.id ? "Editar ficha" : "Nuevo trabajador"}</DialogTitle></DialogHeader>
    <form onSubmit={submit} className="grid gap-3 text-sm sm:grid-cols-2"><fieldset disabled={busy} className="contents">
    {(["name", "position", "team", "monthly_hours"] as const).map((k, i) => <label key={k}>{["Nombre completo", "Cargo", "Equipo", "Horas contratadas al mes"][i]}<Input required={k !== "team"} type={k === "monthly_hours" ? "number" : "text"} min="0" max={k === "monthly_hours" ? 744 : undefined} step=".01" value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })}/></label>)}
    {(["contract", "identifier", "availability"] as const).map((k, i) => <label key={k}>{["Tipo de contrato", "Documento (últimos caracteres)", "Disponibilidad habitual"][i]}<Input maxLength={k === "identifier" ? 5 : undefined} value={draft.profile[k]} onChange={e => profile(k, e.target.value)}/></label>)}
    <label>Correo del acceso al software (opcional)<Input type="email" value={draft.profile.account_email ?? ""} onChange={e => profile("account_email", e.target.value)}/></label>
    <label>Estado<Select disabled={busy} value={draft.profile.state} onValueChange={value => profile("state", value)}><SelectTrigger aria-label="Estado del trabajador"><SelectValue /></SelectTrigger><SelectContent>{["Activo", "Vacaciones", "Incapacidad", "Baja"].map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent></Select></label>
    <StaffAvailabilityFields value={draft.profile} disabled={busy} change={changes => setDraft(current => ({ ...current, profile: { ...current.profile, ...changes } }))} />
    {Object.entries(costLabels).map(([k, label]) => <label key={k}>{label} (€/mes)<Input required type="number" min="0" step=".01" value={draft.profile[k as CostKey]} onChange={e => profile(k, e.target.value)}/></label>)}
    <fieldset className="col-span-full grid gap-2"><legend>Documentos vinculados</legend>{draft.profile.documents.map((d, i) => <div key={d._key} className="flex flex-wrap gap-1">{(["name", "url"] as const).map(k => <Input key={k} aria-label={k === "url" ? "Enlace HTTPS" : "Título del documento"} required type="text" pattern={k === "url" ? "(https://.*|/api/v1/staff-files/[0-9]+/download)" : undefined} placeholder={k === "url" ? "https://…" : "Título"} value={d[k]} onChange={e => setDraft({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.map((v, j) => j === i ? { ...v, [k]: e.target.value } : v) } })}/>)}<label>Caducidad<DatePicker value={d.expires_on ?? ""} onValueChange={value => setDraft({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.map((v, j) => j === i ? { ...v, expires_on: value || null } : v) } })}/></label>
        <label>Tipo<Select disabled={busy} value={d.document_type ?? "other"} onValueChange={value => setDraft({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.map((row, position) => position === i ? { ...row, document_type: value, qualification_code: value === "training" ? row.qualification_code : null } : row) } })}><SelectTrigger aria-label="Tipo de documento"><SelectValue /></SelectTrigger><SelectContent>{[["other", "Documento"], ["training", "Formación"], ["epi", "Entrega de EPI"], ["contract", "Contrato"], ["payroll", "Nómina"]].map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></label>
        {d.document_type === "training" && <><label>Acreditación<Select disabled={busy} value={d.qualification_code ?? "none"} onValueChange={value => setDraft({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.map((row, position) => position === i ? { ...row, qualification_code: value === "none" ? null : value as QualificationCode } : row) } })}><SelectTrigger aria-label="Acreditación de formación"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Pendiente de identificar</SelectItem>{Object.entries(QUALIFICATIONS).map(([code, label]) => <SelectItem key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></label><label>Fecha de emisión<DatePicker value={d.issued_on ?? ""} onValueChange={value => setDraft({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.map((row, position) => position === i ? { ...row, issued_on: value || null } : row) } })}/></label></>}
        <label>Versión<Input value={d.version ?? "1"} maxLength={20} onChange={e => setDraft({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.map((v, j) => j === i ? { ...v, version: e.target.value } : v) } })}/></label>
        <Button type="button" variant="ghost" onClick={() => setDraft({ ...draft, profile: { ...draft.profile, documents: draft.profile.documents.filter((_, j) => j !== i) } })}>Quitar</Button></div>)}<Button type="button" variant="outline" onClick={() => setDraft({ ...draft, profile: { ...draft.profile, documents: [...draft.profile.documents, { name: "", url: "", _key: createClientId() }] } })}>Vincular documento</Button></fieldset>
    {worker.id > 0 && <label className="col-span-full">Subir documento PDF o imagen<Input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} onChange={e => {
                const file = e.target.files?.[0];
                if (!file)
                    return;
                setBusy(true);
                setError("");
                void StaffService.uploadDocument(worker.id, file).then(document => setDraft(current => ({ ...current, profile: { ...current.profile, documents: [...current.profile.documents, { ...document, _key: createClientId() }] } })))
                    .catch(e => setError(e.message)).finally(() => setBusy(false));
            }}/></label>}
    {error && <p role="alert">{error}</p>}<Button disabled={busy} className="col-span-full">Guardar ficha</Button></fieldset></form></DialogContent></Dialog>;
}
