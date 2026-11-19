"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { documentRegister, type PortalDocumentWorkspace, type RegisteredDocument } from "@/services/document-register.service";
import { documentKey } from "@/lib/document-register-format";
import { DocumentRegisterTable } from "@/components/documents/DocumentRegisterTable";
import { DocumentRecordDetail } from "@/components/documents/DocumentRecordDetail";
import { DocumentSignDialog } from "@/components/documents/DocumentSignDialog";

export function ClientPortalDocuments({ workspaceId, signerName }: { workspaceId: number; signerName: string }) {
    const [offset, setOffset] = useState(0), [revision, setRevision] = useState(0), [selected, setSelected] = useState("");
    const [result, setResult] = useState<{ key: string; data: PortalDocumentWorkspace } | null>(null), [error, setError] = useState("");
    const [sign, setSign] = useState<RegisteredDocument | null>(null);
    const key = `${workspaceId}:${offset}:${revision}`;
    const request = useCallback(() => documentRegister.portalList(workspaceId, offset), [workspaceId, offset]);
    useResourceEffect(true, key, request, data => { setResult({ key, data }); setError(""); }, reason => setError(reason instanceof Error ? reason.message : "No se pudo cargar la documentación compartida."));
    const data = result?.key === key ? result.data : null, current = data?.records.find(row => documentKey(row) === selected) ?? data?.records[0];
    return <section className="@container space-y-4"><header className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">Documentación compartida</h2><p className="mt-1 text-sm text-muted-foreground">Archivos que tu proveedor ha publicado para este cliente y sus centros, con la revisión y las firmas correspondientes.</p></div><Button size="sm" variant="outline" onClick={() => setRevision(value => value + 1)}>Actualizar</Button></header>{error && <p role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-sm text-orange-700">{error}</p>}{!data && !error && <p role="status" className="text-sm text-muted-foreground">Cargando archivos publicados…</p>}{data && <><div className="grid items-start gap-4 @[58rem]:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]"><DocumentRegisterTable emptyMessage="Tu proveedor aún no ha compartido documentos en esta vista. Aparecerán cuando publique una revisión para tu cliente o sus centros." records={data.records} select={row => setSelected(documentKey(row))} />{current && <DocumentRecordDetail document={current} portal sign={() => setSign(current)} />}</div><footer className="flex flex-wrap justify-between gap-3 text-xs text-muted-foreground"><span>Resultados desde {data.offset + 1}. Solo revisiones publicadas para este acceso.</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 100))}>Anteriores</Button><Button size="sm" variant="outline" disabled={!data.has_more} onClick={() => setOffset(value => value + 100)}>Siguientes</Button></div></footer></>}{sign && <DocumentSignDialog document={sign} statement={data?.statement ?? ""} signerName={signerName} portalGrant={workspaceId} close={() => setSign(null)} saved={() => setRevision(value => value + 1)} />}</section>;
}
