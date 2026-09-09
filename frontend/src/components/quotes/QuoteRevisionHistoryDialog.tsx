"use client";

import { CheckCircle2, Clock3, FileText } from "lucide-react";

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
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote, QuoteRevision } from "@/types/quote";

type QuoteRevisionHistoryDialogProps = {
    quote: Quote;
    revisions: QuoteRevision[];
    open: boolean;
    loading: boolean;
    onOpenChange: (open: boolean) => void;
};

export function QuoteRevisionHistoryDialog({
    quote,
    revisions,
    open,
    loading,
    onOpenChange,
}: QuoteRevisionHistoryDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="gap-5 sm:max-w-xl">
                <DialogHeader className="pr-10">
                    <DialogTitle>Historial de versiones</DialogTitle>
                    <DialogDescription>
                        Cada versión enviada queda congelada. La aceptación se vincula a una versión concreta.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                    {loading ? (
                        <p className="rounded-xl border border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">Cargando versiones…</p>
                    ) : revisions.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">Todavía no hay versiones enviadas para este presupuesto.</p>
                    ) : revisions.map((revision) => {
                        const accepted = revision.id === quote.accepted_revision_id;
                        return (
                            <article key={revision.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/35 p-3.5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-[var(--text-main)]">Versión {revision.version}</p>
                                            {accepted && <Badge variant="secondary"><CheckCircle2 className="size-3" />Aceptada</Badge>}
                                        </div>
                                        <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{revision.snapshot.title}</p>
                                        <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><Clock3 className="size-3" />Enviada {formatDate(revision.created_at)}</p>
                                    </div>
                                    <span className="shrink-0 font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(revision.snapshot.total_amount)}</span>
                                </div>
                                <p className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--text-muted)]"><FileText className="size-3.5 text-accent" />{revision.snapshot.items.length} {revision.snapshot.items.length === 1 ? "concepto" : "conceptos"}</p>
                            </article>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
