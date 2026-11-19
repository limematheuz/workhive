"use client";
import { useState, type FormEvent } from "react";
import { FilePlus2 } from "lucide-react";
import { DocumentFormDialog } from "@/components/billing/DocumentFormDialog";
import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { DocumentFormField } from "@/components/billing/DocumentFormField";
import { DocumentFormInput, documentControlClassName } from "@/components/billing/DocumentFormControls";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SelectField } from "@/components/ui/select-field";
import { DatePicker } from "@/components/ui/date-picker";
import { documentRegister, type DocumentOwnerType, type DocumentRegisterWorkspace, type RegisteredDocument } from "@/services/document-register.service";
import { documentOwnerLabels, documentTypeLabels } from "@/lib/document-register-format";

const plural = { client: "clients", location: "locations", staff: "staff" } as const;
export function DocumentUploadDialog({ owners, record, fixedOwner, close, saved }: { owners: DocumentRegisterWorkspace["owners"]; record?: RegisteredDocument | null; fixedOwner?: { type: DocumentOwnerType; id?: number }; close: () => void; saved: (row: RegisteredDocument) => void }) {
    const available = (Object.keys(plural) as DocumentOwnerType[]).filter(kind => owners[plural[kind]].some(owner => owner.can_manage));
    const [type, setType] = useState<DocumentOwnerType>(record?.owner_type ?? fixedOwner?.type ?? available[0] ?? "client");
    const [ownerId, setOwnerId] = useState(String(record?.owner_id ?? fixedOwner?.id ?? ""));
    const [title, setTitle] = useState(record?.current?.title ?? record?.title ?? ""), [documentType, setDocumentType] = useState(record?.document_type ?? "other");
    const [expires, setExpires] = useState(record?.current?.expires_on ?? ""), [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    const targets = owners[plural[type]].filter(owner => owner.can_manage);
    const owner = targets.find(item => String(item.id) === ownerId);
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); setError("");
        if (!file || !title.trim() || (!record && !owner)) { setError("Selecciona la ficha, el título y un archivo."); return; }
        if (file.size > 10 * 1024 * 1024) { setError("El archivo debe ocupar como máximo 10 MB; también se aplican los límites del plan."); return; }
        const body = new FormData(); body.append("file", file); body.append("title", title.trim());
        if (expires) body.append("expires_on", expires);
        if (record?.id && record.current) body.append("expected_revision", String(record.current.revision));
        else { body.append("owner_type", type); body.append("owner_id", ownerId); body.append("document_type", documentType); }
        setBusy(true);
        try { const row = record?.id ? await documentRegister.addRevision(record.id, body) : await documentRegister.create(body); saved(row); close(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo subir el documento."); }
        finally { setBusy(false); }
    }
    return <DocumentFormDialog open onOpenChange={open => { if (!open && !busy) close(); }} onSubmit={event => void submit(event)} icon={<FilePlus2 className="size-5" />} title={record ? "Añadir revisión" : "Nuevo documento"} description={record ? "La nueva revisión conserva el historial y las firmas anteriores. Su publicación para el cliente se decide por separado." : "Vincula el archivo a una ficha real y controla sus revisiones, caducidad y firmas."} sidebar={<div className="space-y-3 rounded-2xl border bg-muted/30 p-4"><h3 className="font-semibold">Archivo privado</h3><p className="text-sm text-muted-foreground">{record?.owner_name ?? owner?.name ?? "Selecciona una ficha"}</p><p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP. Hasta 10 MB según el espacio disponible de tu plan.</p>{record && <p className="text-xs text-muted-foreground">Revisión actual: {record.current?.revision}. Las firmas se conservan en la versión que se firmó.</p>}</div>} cancelLabel="Cancelar" submitLabel={record ? "Guardar nueva revisión" : "Guardar documento"} submittingLabel="Guardando…" submitting={busy} submitDisabled={busy || !file || (!record && !owner)} onCancel={() => { if (!busy) close(); }}>
        {error && <p role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700">{error}</p>}
        <DocumentFormSection title="Ficha vinculada" description="Los permisos de esta ficha protegen el archivo y sus revisiones."><div className="grid gap-4 sm:grid-cols-2"><DocumentFormField id="document-owner-type" label="Tipo de ficha"><SelectField id="document-owner-type" aria-label="Tipo de ficha documental" value={type} onValueChange={value => { setType(value as DocumentOwnerType); setOwnerId(""); }} disabled={Boolean(record || fixedOwner) || busy} className={documentControlClassName} options={(record ? [record.owner_type] : available).map(value => ({ value, label: documentOwnerLabels[value] }))} /></DocumentFormField><DocumentFormField id="document-owner" label={documentOwnerLabels[type]}><SearchableSelect id="document-owner" aria-label={documentOwnerLabels[type]} required value={ownerId} onValueChange={setOwnerId} disabled={Boolean(record || fixedOwner?.id) || busy} className={documentControlClassName} options={targets.map(item => ({ value: String(item.id), label: item.name }))} /></DocumentFormField></div></DocumentFormSection>
        <DocumentFormSection title="Datos de la revisión" description="Una fecha de caducidad vacía indica que no se ha registrado vencimiento para esta revisión."><div className="space-y-4"><DocumentFormField id="document-title" label="Título"><DocumentFormInput id="document-title" required minLength={2} maxLength={255} value={title} onChange={event => setTitle(event.target.value)} disabled={busy} /></DocumentFormField><div className="grid gap-4 sm:grid-cols-2"><DocumentFormField id="document-type" label="Tipo de documento"><SelectField id="document-type" aria-label="Tipo de documento" value={documentType} onValueChange={setDocumentType} disabled={Boolean(record) || busy} className={documentControlClassName} options={[...Object.entries(documentTypeLabels).map(([value, label]) => ({ value, label })), ...(!(documentType in documentTypeLabels) ? [{ value: documentType, label: documentType }] : [])]} /></DocumentFormField><DocumentFormField id="document-expiry" label="Caducidad (opcional)"><DatePicker id="document-expiry" value={expires} onValueChange={setExpires} disabled={busy} /></DocumentFormField></div><DocumentFormField id="document-file" label="Archivo"><DocumentFormInput id="document-file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} /></DocumentFormField></div></DocumentFormSection>
    </DocumentFormDialog>;
}
