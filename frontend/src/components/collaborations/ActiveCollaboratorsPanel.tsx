"use client";

import { ArrowRightLeft, Loader2, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
        <section className="billing-surface billing-surface-accent-pad relative overflow-hidden rounded-[24px]">
            <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" aria-hidden="true" />

            <div className="relative z-10 space-y-4">
                <header className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-accent">
                        <Users className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                        <h2 className="text-base font-semibold text-[var(--text-main)]">
                            Mis colaboradores activos
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                            Empresas vinculadas con las que compartes lugares y servicios.
                        </p>
                    </div>
                </header>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-accent" />
                    </div>
                ) : collaborations.length === 0 ? (
                    <div className="billing-block rounded-2xl px-5 py-10 text-center">
                        <ArrowRightLeft className="mx-auto mb-2.5 h-7 w-7 text-[var(--text-muted)]" />
                        <p className="text-sm font-medium text-[var(--text-muted)]">
                            No tienes colaboradores vinculados actualmente
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                        {collaborations.map((collab) => {
                            const isInitiator = collab.initiator_company_id === companyId;
                            const partnerCompany = isInitiator ? collab.partner : collab.initiator;
                            const partnerEmail = partnerCompany.contact_email || partnerCompany.email;

                            let relationDesc = "";
                            if (collab.role_type === "service_provider") {
                                relationDesc = isInitiator
                                    ? "Empresa proveedora de servicios"
                                    : "Empresa que solicita tus servicios";
                            } else {
                                relationDesc = isInitiator
                                    ? "Empresa que solicita tus servicios"
                                    : "Empresa proveedora de servicios";
                            }

                            return (
                                <article
                                    key={collab.id}
                                    className="billing-block flex flex-col gap-3 rounded-2xl p-3.5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="truncate text-sm font-semibold text-[var(--text-main)]">
                                                {partnerCompany.name}
                                            </h3>
                                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                                {relationDesc}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent"
                                        >
                                            Activo
                                        </Badge>
                                    </div>

                                    <dl className="space-y-1.5 border-t border-[var(--border-soft)] pt-2.5 text-xs">
                                        {partnerCompany.tax_id && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[var(--text-muted)]">CIF/NIF</dt>
                                                <dd className="font-medium text-[var(--text-main)]">
                                                    {partnerCompany.tax_id}
                                                </dd>
                                            </div>
                                        )}
                                        {partnerEmail && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="shrink-0 text-[var(--text-muted)]">Email</dt>
                                                <dd className="break-all text-right font-medium text-[var(--text-main)]">
                                                    {partnerEmail}
                                                </dd>
                                            </div>
                                        )}
                                        {partnerCompany.phone && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[var(--text-muted)]">Teléfono</dt>
                                                <dd className="font-medium text-[var(--text-main)]">
                                                    {partnerCompany.phone}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>

                                    <div className="flex justify-end border-t border-[var(--border-soft)] pt-2.5">
                                        <Button
                                            type="button"
                                            variant="dangerSoft"
                                            size="xs"
                                            onClick={() => onUnlink(collab)}
                                        >
                                            <XCircle className="h-3.5 w-3.5" />
                                            Desvincular
                                        </Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
