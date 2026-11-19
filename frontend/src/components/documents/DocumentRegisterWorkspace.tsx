"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useUser } from "@/lib/user-context";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { documentRegister, type DocumentOwnerType, type DocumentRegisterWorkspace as Workspace, type RegisteredDocument } from "@/services/document-register.service";
import { documentKey, documentOwnerLabels } from "@/lib/document-register-format";
import { DocumentRegisterTable } from "./DocumentRegisterTable";
import { DocumentRecordDetail } from "./DocumentRecordDetail";
import { DocumentUploadDialog } from "./DocumentUploadDialog";
import { DocumentSignDialog } from "./DocumentSignDialog";
import { DocumentRevisionHistory } from "./DocumentRevisionHistory";
import { DocumentPublicationDialog } from "./DocumentPublicationDialog";

type Props = { ownerType?: DocumentOwnerType; ownerId?: number; companyId?: number; embedded?: boolean; selfService?: boolean };
type Filters = { type: string; owner: string; search: string; offset: number };
const plural = { client: "clients", location: "locations", staff: "staff" } as const;
function initialFilters(scope: string): Filters {
    try {
        const saved = JSON.parse(sessionStorage.getItem(scope) ?? "null");
        if (saved && ["", "client", "location", "staff"].includes(saved.type)) return { type: saved.type, owner: /^\d+$/.test(saved.owner) ? saved.owner : "", search: String(saved.search ?? "").slice(0, 200), offset: Number.isSafeInteger(saved.offset) && saved.offset >= 0 ? saved.offset : 0 };
    } catch {}
    return { type: "", owner: "", search: "", offset: 0 };
}
export function DocumentRegisterWorkspace(props: Props) {
    const { user, loading } = useUser();
    if (loading || !user) return <p role="status" className="p-4 text-sm text-muted-foreground">Cargando documentación…</p>;
    if (props.selfService && (props.ownerType !== "staff" || !props.ownerId)) return <p role="status" className="p-4 text-sm text-muted-foreground">No hay una ficha de personal vinculada a este acceso.</p>;
    const scope = `${user.id}:${user.company_id}:${props.companyId}:${props.ownerType}:${props.ownerId}:${Boolean(props.selfService)}`;
    return <RegisterContent key={scope} {...props} scope={scope} signerName={user.full_name ?? ""} />;
}
function RegisterContent({ ownerType, ownerId, companyId, embedded, selfService, scope, signerName }: Props & { scope: string; signerName: string }) {
    const cache = "workhive.document-filters:" + scope;
    const [filters, setFilters] = useState(() => initialFilters(cache)), [draft, setDraft] = useState(() => initialFilters(cache).search);
    const [revision, setRevision] = useState(0), [selected, setSelected] = useState("");
    const [result, setResult] = useState<{ key: string; data: Workspace } | null>(null), [error, setError] = useState("");
    const [upload, setUpload] = useState<RegisteredDocument | null | undefined>(undefined), [sign, setSign] = useState<{ row: RegisteredDocument; statement: string } | null>(null), [history, setHistory] = useState<RegisteredDocument | null>(null), [publication, setPublication] = useState<{ row: RegisteredDocument; revoke: boolean } | null>(null), [linking, setLinking] = useState(false);
    const type = ownerType ?? (filters.type || undefined) as DocumentOwnerType | undefined, owner = ownerId ?? (filters.owner ? Number(filters.owner) : undefined);
    const key = `${scope}:${type}:${owner}:${filters.search}:${filters.offset}:${revision}`;
    const request = useCallback(() => documentRegister.list({ owner_type: type, owner_id: owner, company_id: companyId, search: filters.search, offset: filters.offset }), [type, owner, companyId, filters.search, filters.offset]);
    useResourceEffect(true, key, request, data => { setResult({ key, data }); setError(""); }, reason => setError(reason instanceof Error ? reason.message : "No se pudo cargar la documentación."));
    const data = result?.key === key ? result.data : null;
    const current = data?.records.find(row => documentKey(row) === selected) ?? data?.records[0];
    const choices = type && data ? data.owners[plural[type]] : [];
    const canCreate = !selfService && data && (ownerType ? data.owners[plural[ownerType]].some(item => item.can_manage && (!ownerId || item.id === ownerId)) : Object.values(data.owners).some(rows => rows.some(item => item.can_manage)));
    const fixedOwner = ownerType ? { type: ownerType, id: ownerId } : undefined;
    function change(patch: Partial<Filters>) { const next = { ...filters, ...patch }; setFilters(next); try { sessionStorage.setItem(cache, JSON.stringify(next)); } catch {} }
    const refresh = () => setRevision(value => value + 1);
    function saved(row: RegisteredDocument, locate = false) { setSelected(documentKey(row)); if (locate) { change({ type: row.owner_type, owner: String(row.owner_id), search: "", offset: 0 }); setDraft(""); } refresh(); }
    async function prepareSign(row: RegisteredDocument) {
        if (linking) return;
        if (row.id !== null) { setSign({ row, statement: data?.statement ?? "" }); return; }
        if (!row.source_type || !row.source_id) return;
        setLinking(true); setError("");
        try { const registered = await documentRegister.link({ source_type: row.source_type, source_id: row.source_id }); setSelected(documentKey(registered)); setSign({ row: registered, statement: data?.statement ?? "" }); refresh(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo preparar la revisión para firmar."); }
        finally { setLinking(false); }
    }
    return <div className={embedded ? "@container space-y-4" : "@container dashboard-page-content space-y-4 px-[3%] py-6 md:p-8"}>
        <PageHeader icon={FileText} title={embedded ? "Documentación de la ficha" : "Centro de documentación"} subtitle="Archivos reales, revisiones, caducidad y firmas simples vinculadas a cada ficha." actions={<><Button size="sm" variant="outline" disabled={linking} aria-label="Actualizar documentación" onClick={refresh}><RefreshCw className="size-4" /></Button>{canCreate && <Button size="sm" onClick={() => setUpload(null)}><Plus className="size-4" />Nuevo documento</Button>}</>} />
        <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3" onSubmit={event => { event.preventDefault(); change({ search: draft.trim(), offset: 0 }); }}><label className="min-w-48 flex-1 text-xs font-medium">Buscar documento<Input type="search" value={draft} maxLength={200} onChange={event => setDraft(event.target.value)} placeholder="Título, ficha o tipo de documento" /></label>{!ownerType && <label className="w-full text-xs font-medium sm:w-40">Tipo de ficha<SelectField aria-label="Filtrar tipo de ficha" value={filters.type} onValueChange={value => change({ type: value, owner: "", offset: 0 })} options={[{ value: "", label: "Todas las fichas" }, ...Object.entries(documentOwnerLabels).map(([value, label]) => ({ value, label }))]} /></label>}{!ownerId && type && <label className="min-w-48 flex-1 text-xs font-medium">{documentOwnerLabels[type]}<SearchableSelect aria-label={documentOwnerLabels[type]} value={filters.owner} onValueChange={value => change({ owner: value, offset: 0 })} options={[{ value: "", label: "Todas las fichas autorizadas" }, ...choices.map(item => ({ value: String(item.id), label: item.name }))]} /></label>}<Button variant="outline" size="sm">Buscar</Button></form>
        {error && <p role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">{error}<Button size="sm" variant="outline" className="ml-3" onClick={refresh}>Reintentar</Button></p>}{!data && !error && <p role="status" className="text-sm text-muted-foreground">Cargando documentos autorizados…</p>}
        {data && <><div className="grid items-start gap-4 @[58rem]:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]"><DocumentRegisterTable key={key} records={data.records} select={row => setSelected(documentKey(row))} />{current && <DocumentRecordDetail key={documentKey(current)} document={current} sign={() => void prepareSign(current)} revise={!selfService && current.id ? () => setUpload(current) : undefined} history={current.id ? () => setHistory(current) : undefined} publish={selfService ? undefined : () => setPublication({ row: current, revoke: false })} revoke={selfService ? undefined : () => setPublication({ row: current, revoke: true })} />}</div><footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>Resultados desde {data.offset + 1}. Hasta 100 registros por consulta.</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!filters.offset} onClick={() => change({ offset: Math.max(0, filters.offset - 100) })}>Resultados anteriores</Button><Button size="sm" variant="outline" disabled={!data.has_more} onClick={() => change({ offset: filters.offset + 100 })}>Más resultados</Button></div></footer>{!embedded && data.owners.locations.length > 0 && <Button size="sm" variant="outline" asChild><Link href="/dashboard/documents/centros">Biblioteca operativa de centros</Link></Button>}
            {upload !== undefined && <DocumentUploadDialog owners={data.owners} record={upload} fixedOwner={fixedOwner} close={() => setUpload(undefined)} saved={row => saved(row, true)} />}
        </>}
        {linking && <p role="status" className="text-sm text-muted-foreground">Preparando la revisión del archivo…</p>}{sign && <DocumentSignDialog key={documentKey(sign.row)} document={sign.row} statement={sign.statement} signerName={signerName} close={() => setSign(null)} saved={row => saved(row)} />}{history?.id && <DocumentRevisionHistory documentId={history.id} title={history.title} close={() => setHistory(null)} />}{publication && <DocumentPublicationDialog document={publication.row} revoke={publication.revoke} close={() => setPublication(null)} saved={row => saved(row)} />}
    </div>;
}
