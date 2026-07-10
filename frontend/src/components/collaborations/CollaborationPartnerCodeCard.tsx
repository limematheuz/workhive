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
        <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-40 h-40 bg-accent/5 rounded-full filter blur-2xl pointer-events-none -mr-10 -mt-10" />

            <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent/5 border border-accent/10 flex items-center justify-center text-accent">
                        <Building className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Código de mi empresa</h3>
                        <p className="text-2xs text-[var(--text-muted)] font-medium">Comparte este código con tus clientes o proveedores para que soliciten la vinculación.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="h-14 flex items-center">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    </div>
                ) : (
                    <div className="flex items-center justify-between bg-[var(--bg-tertiary)] border border-[var(--border-soft)] px-5 py-3 rounded-2xl">
                        <span className="font-mono text-base font-black tracking-wider text-accent select-all">
                            {partnerCode || "Cargando..."}
                        </span>
                        <Button
                            onClick={onCopy}
                            variant="ghost"
                            className="p-2.5 h-auto text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                        >
                            <Copy className="h-4.5 w-4.5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
