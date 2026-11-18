"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SelectField } from "@/components/ui/select-field";
import { laborCommunications, type LaborCommunicationWorkspace, type LaborKind, type LaborDocument } from "@/services/labor-communications.service";

export const laborKinds = [{ value: "hire", label: "Alta" }, { value: "termination", label: "Baja" }, { value: "contract_change", label: "Cambio contractual" }, { value: "other", label: "Otra comunicación" }];
export function LaborCommunicationForm({ company, workspace, done }: { company: number; workspace: LaborCommunicationWorkspace; done: () => void }) {
    const [employee, setEmployee] = useState(""), [recipient, setRecipient] = useState(""), [kind, setKind] = useState<LaborKind>("hire");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10)), [subject, setSubject] = useState(""), [description, setDescription] = useState("");
    const [documentSearch, setDocumentSearch] = useState("");
    const [documents, setDocuments] = useState<LaborDocument[]>([]), [selected, setSelected] = useState<LaborDocument[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState("");
    useEffect(() => {
        if (!employee) return;
        let active = true;
        laborCommunications.documents(company, Number(employee), documentSearch).then(data => { if (active) setDocuments(data.records); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo cargar la documentación."); });
        return () => { active = false; };
    }, [company, employee, documentSearch]);
    async function attach(value: string) {
        const document = documents.find(row => (row.id ? `document:${row.id}` : `${row.source_type}:${row.source_id}`) === value);
        if (!document) return;
        setBusy(true); setError("");
        try { const linked = document.id ? document : await laborCommunications.linkDocument(document); if (linked.current?.id) setSelected(rows => rows.some(row => row.current?.id === linked.current?.id) ? rows : [...rows, linked]); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo adjuntar la revisión."); }
        finally { setBusy(false); }
    }
    async function submit(event: FormEvent) {
        event.preventDefault(); setBusy(true); setError("");
        try { await laborCommunications.create(company, { employee_id: Number(employee), recipient_user_id: Number(recipient), kind, effective_on: date, subject, description, document_revision_ids: selected.flatMap(row => row.current?.id ? [row.current.id] : []) }); done(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo enviar."); }
        finally { setBusy(false); }
    }
    return <form onSubmit={event => void submit(event)} className="space-y-4"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1"><Label>Trabajador</Label><SearchableSelect aria-label="Trabajador de la comunicación" required options={workspace.employees.map(row => ({ value: String(row.id), label: row.name }))} value={employee} onValueChange={value => { setEmployee(value); setSelected([]); setDocuments([]); }} /></div>
        <div className="space-y-1"><Label>Gestoría destinataria</Label><SearchableSelect aria-label="Gestoría destinataria" required options={workspace.recipients.map(row => ({ value: String(row.id), label: row.name || row.email, description: row.email }))} value={recipient} onValueChange={setRecipient} /></div>
        <div className="space-y-1"><Label>Comunicación</Label><SelectField aria-label="Tipo de comunicación laboral" value={kind} onValueChange={value => setKind(value as LaborKind)} options={laborKinds} /></div>
        <div className="space-y-1"><Label htmlFor="labor-effective-date">Fecha efectiva comunicada</Label><DatePicker id="labor-effective-date" required value={date} onValueChange={setDate} disabled={busy} /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="labor-subject">Asunto</Label><Input id="labor-subject" required minLength={2} maxLength={200} value={subject} onChange={event => setSubject(event.target.value)} /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="labor-description">Información para tramitar</Label><Textarea id="labor-description" required minLength={2} maxLength={4000} value={description} onChange={event => setDescription(event.target.value)} /></div>
        {employee && <div className="space-y-2 sm:col-span-2"><Label>Adjuntar revisión de un documento del trabajador</Label><SearchableSelect aria-label="Documento de la comunicación" disabled={busy} value="" onSearchChange={setDocumentSearch} onValueChange={value => void attach(value)} options={documents.map(row => ({ value: row.id ? `document:${row.id}` : `${row.source_type}:${row.source_id}`, label: row.title, description: `Revisión ${row.current?.revision ?? 1}` }))} />{selected.map(row => <div key={row.current?.id} className="flex items-center justify-between gap-2 rounded-xl border p-2 text-sm"><span>{row.title} · r{row.current?.revision}</span><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(rows => rows.filter(item => item !== row))}>Quitar</Button></div>)}</div>}
    </fieldset><p className="text-xs text-muted-foreground">La comunicación se registra para la gestoría seleccionada. Su recepción y tramitación se confirmarán en el seguimiento; la ficha laboral no cambia automáticamente.</p>{error && <p role="alert" className="text-sm text-orange-700 dark:text-orange-300">{error}</p>}<Button disabled={busy || !employee || !recipient}>{busy ? "Enviando…" : "Enviar a la gestoría"}</Button></form>;
}
