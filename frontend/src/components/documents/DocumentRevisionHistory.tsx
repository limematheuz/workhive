"use client";
import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { documentRegister, safeDocumentDownloadUrl, type DocumentRevision } from "@/services/document-register.service";
import { documentCalendarDate, documentTimestamp } from "@/lib/document-register-format";

export function DocumentRevisionHistory({ documentId, title, close }: { documentId: number; title: string; close: () => void }) {
    const [rows, setRows] = useState<DocumentRevision[] | null>(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
    const request = useCallback(() => documentRegister.versions(documentId), [documentId]);
    useResourceEffect(true, `${documentId}:${revision}`, request, data => { setRows(data); setError(""); }, reason => setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial."));
    return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Historial de revisiones</DialogTitle><DialogDescription>{title}. Cada firma conserva la revisión y el archivo que se revisó.</DialogDescription></DialogHeader>{error && <div role="alert" className="space-y-2 text-sm text-orange-700"><p>{error}</p><Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>Reintentar</Button></div>}{!rows && !error && <p role="status" className="text-sm text-muted-foreground">Cargando revisiones…</p>}{rows?.map(row => <article key={row.id} className="space-y-3 rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Revisión {row.revision} · {row.title}</h3><p className="mt-1 text-xs text-muted-foreground">{documentTimestamp(row.created_at)} · {row.file_name}</p><p className={row.expired ? "mt-1 text-xs text-orange-700" : "mt-1 text-xs text-muted-foreground"}>{documentCalendarDate(row.expires_on)}</p></div>{safeDocumentDownloadUrl(row.download_url) && <Button size="sm" variant="outline" asChild><a href={row.download_url} target="_blank" rel="noopener noreferrer">Abrir</a></Button>}</div><p className="text-xs text-muted-foreground">{row.signatures.length} firmas de esta revisión</p>{row.signatures.map(signature => <p key={signature.id} className="border-t pt-2 text-xs">{signature.signer_name}{signature.user_name ? ` · Cuenta: ${signature.user_name}` : ""}<span className="mt-1 block text-muted-foreground">{documentTimestamp(signature.signed_at)} · Firma simple</span></p>)}</article>)}</DialogContent></Dialog>;
}
