"use client";

import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompanyCollaboration } from "@/types/collaboration";

type CollaborationRequestsPanelProps = {
    pendingRequests: CompanyCollaboration[];
    sentRequests: CompanyCollaboration[];
    onAccept: (id: number, name: string) => void;
    onReject: (id: number, name: string) => void;
};

export function CollaborationRequestsPanel({
    pendingRequests,
    sentRequests,
    onAccept,
    onReject,
}: CollaborationRequestsPanelProps) {
    if (pendingRequests.length === 0 && sentRequests.length === 0) {
        return null;
    }

    return (
        <section className="billing-surface billing-surface-accent-pad relative overflow-hidden rounded-[24px]">
            <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" aria-hidden="true" />

            <div className="relative z-10 space-y-4">
                <header className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-accent">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="text-base font-semibold text-[var(--text-main)]">
                            Solicitudes de vinculación
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                            Revisa peticiones recibidas y el estado de las enviadas.
                        </p>
                    </div>
                </header>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {pendingRequests.length > 0 && (
                        <div className="space-y-2.5">
                            <h3 className="text-xs font-semibold text-[var(--text-muted)]">
                                Solicitudes recibidas
                            </h3>
                            <div className="space-y-2">
                                {pendingRequests.map((req) => {
                                    const partnerCompany = req.initiator;
                                    return (
                                        <div
                                            key={req.id}
                                            className="billing-block flex flex-col justify-between gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center"
                                        >
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="truncate text-sm font-semibold text-[var(--text-main)]">
                                                    {partnerCompany.name}
                                                </h4>
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    Relación propuesta:{" "}
                                                    {req.role_type === "service_provider"
                                                        ? "Prestará servicios"
                                                        : "Solicitará servicios"}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <Button
                                                    type="button"
                                                    size="xs"
                                                    onClick={() => onAccept(req.id, partnerCompany.name)}
                                                >
                                                    Aceptar
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="xs"
                                                    variant="dangerSoft"
                                                    onClick={() => onReject(req.id, partnerCompany.name)}
                                                >
                                                    Rechazar
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {sentRequests.length > 0 && (
                        <div className="space-y-2.5">
                            <h3 className="text-xs font-semibold text-[var(--text-muted)]">
                                Solicitudes enviadas
                            </h3>
                            <div className="space-y-2">
                                {sentRequests.map((req) => {
                                    const partnerCompany = req.partner;
                                    return (
                                        <div
                                            key={req.id}
                                            className="billing-block flex items-center justify-between gap-3 rounded-xl p-3.5"
                                        >
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="truncate text-sm font-semibold text-[var(--text-main)]">
                                                    {partnerCompany.name}
                                                </h4>
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    Relación propuesta:{" "}
                                                    {req.role_type === "service_provider"
                                                        ? "Prestará servicios"
                                                        : "Solicitará servicios"}
                                                </p>
                                            </div>
                                            <Badge
                                                variant="outline"
                                                className="shrink-0 border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent"
                                            >
                                                Pendiente
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
