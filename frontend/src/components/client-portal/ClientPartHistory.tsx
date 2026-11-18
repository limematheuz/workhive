"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TaskClientPublicationService, type PartAcceptance } from "@/services/task-client-publication.service";

export function ClientPartHistory({ workspaceId, publicationId, timezone, initial }: { workspaceId: number; publicationId: number; timezone: string; initial: PartAcceptance[] }) {
    const [rows, setRows] = useState(initial);
    const [offset, setOffset] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const dates = useMemo(() => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }), [timezone]);
    async function load() {
        setBusy(true); setError("");
        try {
            const page = await TaskClientPublicationService.history(workspaceId, publicationId, offset);
            setRows(current => loaded ? [...current, ...page.items] : page.items);
            setOffset(value => value + 100); setLoaded(true); setHasMore(page.has_more);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial."); } finally { setBusy(false); }
    }
    return <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Historial de validaciones del trabajo</summary><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{rows.map(row => <li key={row.revision}>Revisión {row.revision} · {row.signer_name} · {dates.format(new Date(row.accepted_at))}</li>)}</ul>{!rows.length && <p className="mt-2 text-xs text-muted-foreground">Todavía no hay validaciones registradas.</p>}{error && <p role="alert" className="mt-2 text-xs text-orange-700 dark:text-orange-300">{error}</p>}{hasMore && <Button type="button" size="sm" variant="ghost" className="mt-2" disabled={busy} onClick={() => void load()}>{busy ? "Cargando…" : loaded ? "Cargar más validaciones" : "Consultar historial completo"}</Button>}</details>;
}
