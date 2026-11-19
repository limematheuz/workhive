import { Button } from "@/components/ui/button";

export function RecordLinkNotice({ phase, error, label, retry, clear }: {
    phase: string; error: string | null; label: string; retry: () => void; clear: () => void;
}) {
    if (phase === "loading") return <p role="status" className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Cargando {label}…</p>;
    if (phase !== "failed") return null;
    return <div role="alert" className="space-y-3 rounded-xl border border-orange-400/40 bg-card p-4 text-sm">
        <p className="text-orange-700 dark:text-orange-300">{error || `No se pudo consultar ${label}.`}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={retry}>Reintentar</Button>
            <Button variant="ghost" size="sm" onClick={clear}>Volver al listado</Button></div>
    </div>;
}
