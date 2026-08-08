"use client";

import { Building, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type CollaborationPartnerCodeCardProps = {
    partnerCode: string;
    loading: boolean;
    onCopy: () => void;
};

export function CollaborationPartnerCodeCard({
    partnerCode,
    loading,
    onCopy,
}: CollaborationPartnerCodeCardProps) {
    return (
        <section className="billing-block flex h-full flex-col justify-between rounded-2xl p-3.5 sm:p-4">
            <header className="mb-3 flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--bg-card))] text-accent">
                    <Building className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-main)]">
                        Código de mi empresa
                    </h3>
                    <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                        Comparte este código con tus clientes o proveedores para que soliciten la vinculación.
                    </p>
                </div>
            </header>

            {loading ? (
                <div className="flex h-11 items-center">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-3.5 py-2.5">
                    <span className="select-all font-mono text-sm font-bold tracking-wider text-accent sm:text-base">
                        {partnerCode || "Cargando..."}
                    </span>
                    <Button
                        type="button"
                        onClick={onCopy}
                        variant="outline"
                        size="icon-sm"
                        aria-label="Copiar código de partner"
                        title="Copiar código"
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </section>
    );
}
