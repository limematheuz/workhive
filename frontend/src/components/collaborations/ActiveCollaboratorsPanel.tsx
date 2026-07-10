"use client";

import { ArrowRightLeft, Loader2, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompanyCollaboration } from "@/types/collaboration";

type ActiveCollaboratorsPanelProps = {
    collaborations: CompanyCollaboration[];
    loading: boolean;
    companyId: number | null | undefined;
    onUnlink: (collab: CompanyCollaboration) => void;
};

export function ActiveCollaboratorsPanel({
    collaborations,
    loading,
    companyId,
    onUnlink,
}: ActiveCollaboratorsPanelProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-accent" />
                Mis colaboradores activos
            </h2>

            {loading ? (
                <div className="py-12 flex justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
            ) : collaborations.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[var(--border-soft)] rounded-3xl bg-[var(--bg-card)]/50">
                    <ArrowRightLeft className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-3" />
                    <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">No tienes colaboradores vinculados actualmente</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {collaborations.map((collab) => {
                        const isInitiator = collab.initiator_company_id === companyId;
                        const partnerCompany = isInitiator ? collab.partner : collab.initiator;
                        const partnerEmail = partnerCompany.contact_email || partnerCompany.email;

                        let relationDesc = "";
                        if (collab.role_type === "service_provider") {
                            relationDesc = isInitiator ? "Empresa proveedora de servicios" : "Empresa que solicita tus servicios";
                        } else {
                            relationDesc = isInitiator ? "Empresa que solicita tus servicios" : "Empresa proveedora de servicios";
                        }

                        return (
                            <article
                                key={collab.id}
                                className="border border-[var(--border-soft)] bg-[var(--bg-card)] rounded-3xl p-5 hover:shadow-md hover:translate-y-[-2px] transition-all duration-300 flex flex-col justify-between min-h-[170px]"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-black text-sm text-[var(--text-main)] truncate max-w-[180px]">
                                                {partnerCompany.name}
                                            </h3>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] mt-1">
                                                {relationDesc}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--btn-secondary-text)]">
                                            Activo
                                        </span>
                                    </div>

                                    <div className="text-2xs text-[var(--text-muted)] font-medium space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50">
                                        {partnerCompany.tax_id && (
                                            <p className="flex justify-between">
                                                <span className="font-bold uppercase tracking-wider text-[var(--text-muted)]/80">CIF/NIF:</span>
                                                <span className="font-bold text-[var(--text-main)]">{partnerCompany.tax_id}</span>
                                            </p>
                                        )}
                                        {partnerEmail && (
                                            <p className="flex justify-between">
                                                <span className="font-bold uppercase tracking-wider text-[var(--text-muted)]/80">Email:</span>
                                                <span className="font-bold text-[var(--text-main)] break-all text-right">{partnerEmail}</span>
                                            </p>
                                        )}
                                        {partnerCompany.phone && (
                                            <p className="flex justify-between">
                                                <span className="font-bold uppercase tracking-wider text-[var(--text-muted)]/80">Teléfono:</span>
                                                <span className="font-bold text-[var(--text-main)]">{partnerCompany.phone}</span>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-[var(--border-soft)]/50 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onUnlink(collab)}
                                        className="gap-1.5 rounded-xl bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] h-8 text-[11px] font-semibold uppercase tracking-wider cursor-pointer transition-all"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Desvincular
                                    </Button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
