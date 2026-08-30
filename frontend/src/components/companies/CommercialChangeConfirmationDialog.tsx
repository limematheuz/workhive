"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, ShieldCheck } from "lucide-react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CommercialChange } from "./commercial-change-utils";

type CommercialChangeConfirmationDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    reason: string;
    changes: CommercialChange[];
    confirmLabel: string;
    onConfirm: () => void;
    isSubmitting?: boolean;
    note?: string;
};

export function CommercialChangeConfirmationDialog({
    open,
    onOpenChange,
    title,
    description,
    reason,
    changes,
    confirmLabel,
    onConfirm,
    isSubmitting = false,
    note,
}: CommercialChangeConfirmationDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            {open && (
                <CommercialChangeConfirmationContent
                    title={title}
                    description={description}
                    reason={reason}
                    changes={changes}
                    confirmLabel={confirmLabel}
                    onConfirm={onConfirm}
                    isSubmitting={isSubmitting}
                    note={note}
                />
            )}
        </AlertDialog>
    );
}

function CommercialChangeConfirmationContent({
    title,
    description,
    reason,
    changes,
    confirmLabel,
    onConfirm,
    isSubmitting,
    note,
}: Omit<CommercialChangeConfirmationDialogProps, "open" | "onOpenChange">) {
    const [acknowledged, setAcknowledged] = useState(false);
    const reductions = changes.filter((change) => change.isReduction).length;

    return (
        <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <AlertDialogTitle>{title}</AlertDialogTitle>
                            <AlertDialogDescription className="mt-1">{description}</AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>

                {reductions > 0 && (
                    <div className="flex gap-2 rounded-xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-3 text-sm text-[var(--btn-cancel-text)]">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>Incluye {reductions} reducción{reductions === 1 ? "" : "es"}. WorkHive comprobará que ningún límite quede por debajo del uso actual.</p>
                    </div>
                )}

                <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Resumen de cambios</p>
                    <ul className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
                        {changes.map((change) => (
                            <li className="flex items-center gap-2 text-sm" key={`${change.label}-${change.previous}-${change.next}`}>
                                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-main)]">{change.label}</span>
                                <span className="shrink-0 text-[var(--text-muted)]">{change.previous}</span>
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                                <span className="shrink-0 font-semibold text-[var(--text-main)]">{change.next}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <div className="rounded-xl border border-[var(--border-soft)] p-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Motivo registrado</p>
                    <p className="mt-1 text-[var(--text-main)]">{reason}</p>
                </div>

                {note && <p className="text-xs leading-relaxed text-[var(--text-muted)]">{note}</p>}

                <Label htmlFor="commercial-change-acknowledgement" className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-soft)] p-3 text-sm font-medium text-[var(--text-main)] hover:border-accent/40 hover:bg-accent/5">
                    <Checkbox
                        id="commercial-change-acknowledgement"
                        checked={acknowledged}
                        onCheckedChange={(checked) => setAcknowledged(checked === true)}
                    />
                    He revisado el impacto y autorizo este cambio.
                </Label>

                <AlertDialogFooter className="border-t border-[var(--border-soft)] pt-4">
                    <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={!acknowledged || isSubmitting}
                        onClick={(event) => {
                            event.preventDefault();
                            onConfirm();
                        }}
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
        </AlertDialogContent>
    );
}
