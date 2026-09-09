"use client";

import { useMemo } from "react";
import { Clock3, FileCheck2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { ServiceCatalogVersion, TemplateTask } from "@/types/template";

const serviceVersionDateFormatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
});

function formatVersionPrice(version: ServiceCatalogVersion): string {
    if (version.default_price === null || version.default_price === undefined) return "Sin precio base";
    return `${version.default_price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / ${version.unit}`;
}

function formatVersionDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha no disponible";
    return serviceVersionDateFormatter.format(date);
}

export function ServiceVersionHistoryDialog({
    service,
    versions,
    open,
    onOpenChange,
}: {
    service: TemplateTask | null;
    versions: ServiceCatalogVersion[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const displayVersions = useMemo(
        () => versions.map((version) => ({
            ...version,
            formattedPrice: formatVersionPrice(version),
            publishedAt: formatVersionDate(version.created_at),
        })),
        [versions],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="gap-5 sm:max-w-xl">
                <DialogHeader className="pr-10">
                    <DialogTitle>Historial del servicio</DialogTitle>
                    <DialogDescription>
                        {service ? `Cada cambio de “${service.name}” queda guardado como una versión. Los trabajos ya creados conservan su propio detalle.` : "Consulta las versiones publicadas."}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                    {displayVersions.map((version, index) => (
                        <article key={version.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/35 p-3.5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-[var(--text-main)]">Versión {version.version}</p>
                                        {index === 0 && <Badge variant="secondary">Actual</Badge>}
                                    </div>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">{version.formattedPrice}</p>
                                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">Publicada {version.publishedAt}</p>
                                </div>
                                {version.estimated_duration_minutes && (
                                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--text-muted)]"><Clock3 className="size-3.5" />{version.estimated_duration_minutes} min</span>
                                )}
                            </div>
                            {version.requirements && <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]"><FileCheck2 className="mr-1 inline size-3.5 text-accent" />{version.requirements}</p>}
                        </article>
                    ))}
                    {versions.length === 0 && <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">Este servicio aún no tiene versiones registradas.</p>}
                </div>

                <DialogFooter>
                    <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
