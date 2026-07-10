"use client";

import { Clock } from "lucide-react";
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
        <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-accent" />
                Solicitudes de vinculación
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingRequests.length > 0 && (
                    <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-5 space-y-4">
                        <h3 className="text-2xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Solicitudes Recibidas</h3>
                        <div className="space-y-3">
                            {pendingRequests.map((req) => {
                                const partnerCompany = req.initiator;
                                return (
                                    <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-2xl">
                                        <div className="space-y-1">
                                            <h4 className="font-black text-xs text-[var(--text-main)]">{partnerCompany.name}</h4>
                                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                                Relación propuesta: {req.role_type === "service_provider" ? "Prestará servicios" : "Solicitará servicios"}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => onAccept(req.id, partnerCompany.name)}
                                                className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-[10px] font-semibold rounded-lg px-3 py-1.5 border border-[var(--border-soft)] cursor-pointer"
                                            >
                                                Aceptar
                                            </Button>
                                            <Button
                                                onClick={() => onReject(req.id, partnerCompany.name)}
                                                className="bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] text-[10px] font-semibold rounded-lg px-3 py-1.5 cursor-pointer"
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
                    <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-5 space-y-4">
                        <h3 className="text-2xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Solicitudes Enviadas</h3>
                        <div className="space-y-3">
                            {sentRequests.map((req) => {
                                const partnerCompany = req.partner;
                                return (
                                    <div key={req.id} className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-2xl">
                                        <div className="space-y-1">
                                            <h4 className="font-black text-xs text-[var(--text-main)]">{partnerCompany.name}</h4>
                                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                                Relación propuesta: {req.role_type === "service_provider" ? "Prestará servicios" : "Solicitará servicios"}
                                            </p>
                                        </div>
                                        <span className="text-[9px] font-bold uppercase tracking-wider bg-accent/5 border border-accent/15 text-accent px-2.5 py-1 rounded-full">
                                            Pendiente
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
