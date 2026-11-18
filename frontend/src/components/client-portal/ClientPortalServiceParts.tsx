"use client";
import { useCallback, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientPartDetail } from "./ClientPartDetail";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { TaskClientPublicationService, type PublishedWork } from "@/services/task-client-publication.service";

type Page = { items: PublishedWork[]; has_more: boolean };
export function ClientPortalServiceParts({ workspaceId, defaultSignerName }: { workspaceId: number; defaultSignerName: string }) {
    const [offset, setOffset] = useState(0);
    const [revision, setRevision] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);
    const [result, setResult] = useState<{ key: string; data: Page } | null>(null);
    const [error, setError] = useState("");
    const key = `${workspaceId}:${offset}:${revision}`;
    const request = useCallback(() => TaskClientPublicationService.list(workspaceId, offset), [workspaceId, offset]);
    const received = useCallback((data: Page) => { setResult({ key, data }); setError(""); }, [key]);
    const failed = useCallback((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar los partes."), []);
    useResourceEffect(true, key, request, received, failed);
    const data = result?.key === key ? result.data : null;
    const current = data?.items.find(item => item.id === selected) ?? data?.items[0];
    const refresh = () => { setError(""); setRevision(value => value + 1); };
    const accepted = (part: PublishedWork) => setResult(value => value ? { ...value, data: { ...value.data, items: value.data.items.map(item => item.id === part.id ? part : item) } } : value);
    return <section className="space-y-4"><div className="flex items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList className="size-5 text-accent" />Servicios y partes</h2><p className="mt-1 text-sm text-muted-foreground">Consulta los trabajos que tu proveedor ha compartido, revisa sus fotografías y valida cada revisión.</p></div><Button type="button" variant="outline" size="sm" aria-label="Actualizar servicios publicados" onClick={refresh}><RefreshCw className="size-4" /></Button></div>{error && <p role="alert" className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">{error}</p>}{!data && !error && <p role="status" className="text-sm text-muted-foreground">Cargando servicios compartidos…</p>}
        {data && !data.items.length && <div className="rounded-2xl border bg-card p-8 text-center"><p className="font-semibold">Todavía no hay partes compartidos</p><p className="mt-2 text-sm text-muted-foreground">Los partes y fotografías aparecerán cuando el responsable publique la información de una ejecución.</p></div>}
        {data && data.items.length > 0 && <div className="grid items-start gap-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,2fr)]"><aside className="min-w-0 space-y-2">{data.items.map(part => <Button key={part.id} type="button" variant="ghost" className={`h-auto w-full justify-start whitespace-normal rounded-xl border p-3 text-left ${current?.id === part.id ? "border-accent bg-accent/5" : "bg-card"}`} onClick={() => setSelected(part.id)}><span className="block min-w-0 w-full"><strong className="block text-sm">{part.manifest.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{part.manifest.location_name}</span><span className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span>Revisión {part.revision}</span><span className={part.acceptance ? "text-emerald-700 dark:text-emerald-300" : "text-orange-700 dark:text-orange-300"}>{part.acceptance ? "Validado" : "Pendiente de validar"}</span></span></span></Button>)}<div className="flex flex-wrap gap-2 border-t pt-3"><Button type="button" variant="outline" size="sm" disabled={!offset} onClick={() => setOffset(value => Math.max(0, value - 25))}>Anteriores</Button><Button type="button" variant="outline" size="sm" disabled={!data.has_more} onClick={() => setOffset(value => value + 25)}>Siguientes</Button></div></aside>{current && <ClientPartDetail key={current.id} part={current} workspaceId={workspaceId} defaultSignerName={defaultSignerName} accepted={accepted} refresh={refresh} />}</div>}
    </section>;
}
