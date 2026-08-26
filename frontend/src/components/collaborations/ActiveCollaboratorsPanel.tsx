"use client";

import { ArrowRightLeft, Loader2, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentFormSelect } from "@/components/billing/DocumentFormControls";
import { useDictionary } from "@/lib/dictionary-context";
import { CompanyCollaboration } from "@/types/collaboration";
import { useState } from "react";

type PartnerTypeFilter = "all" | "service_provider" | "property_manager";

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
    const { dict } = useDictionary();
    const [partnerTypeFilter, setPartnerTypeFilter] = useState<PartnerTypeFilter>("all");
    const collaborationWithPartnerType = collaborations.map((collab) => {
        const isInitiator = collab.initiator_company_id === companyId;
        const partnerType = isInitiator
            ? collab.role_type
            : collab.role_type === "service_provider"
              ? "property_manager"
              : "service_provider";

        return { collab, isInitiator, partnerType };
    });
    const visibleCollaborations = collaborationWithPartnerType.filter(
        ({ partnerType }) => partnerTypeFilter === "all" || partnerType === partnerTypeFilter,
    );

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
                            {dict.collaborations.active_title}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                            {dict.collaborations.active_description}
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
                            {dict.collaborations.no_active}
                        </p>
                    </div>
                ) : (
                    <>
                        {collaborations.length > 1 && (
                            <div className="flex justify-end">
                                <DocumentFormSelect
                                    aria-label={dict.collaborations.relationship}
                                    value={partnerTypeFilter}
                                    onChange={(event) => setPartnerTypeFilter(event.target.value as PartnerTypeFilter)}
                                    className="h-10 w-auto min-w-48 py-0"
                                >
                                    <option value="all">{dict.collaborations.all}</option>
                                    <option value="service_provider">{dict.collaborations.service_provider}</option>
                                    <option value="property_manager">{dict.collaborations.property_manager}</option>
                                </DocumentFormSelect>
                            </div>
                        )}
                        {visibleCollaborations.length === 0 ? (
                            <div className="billing-block rounded-2xl px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                                {dict.collaborations.no_filter_matches}
                            </div>
                        ) : (
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                        {visibleCollaborations.map(({ collab, isInitiator, partnerType }) => {
                            const partnerCompany = isInitiator ? collab.partner : collab.initiator;
                            const partnerEmail = partnerCompany.contact_email || partnerCompany.email;
                            const relationDesc = partnerType === "service_provider"
                                ? dict.collaborations.service_provider
                                : dict.collaborations.property_manager;

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
                                            {dict.collaborations.active}
                                        </Badge>
                                    </div>

                                    <dl className="space-y-1.5 border-t border-[var(--border-soft)] pt-2.5 text-xs">
                                        {partnerCompany.tax_id && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[var(--text-muted)]">{dict.collaborations.tax_id}</dt>
                                                <dd className="font-medium text-[var(--text-main)]">
                                                    {partnerCompany.tax_id}
                                                </dd>
                                            </div>
                                        )}
                                        {partnerEmail && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="shrink-0 text-[var(--text-muted)]">{dict.users.email}</dt>
                                                <dd className="break-all text-right font-medium text-[var(--text-main)]">
                                                    {partnerEmail}
                                                </dd>
                                            </div>
                                        )}
                                        {partnerCompany.phone && (
                                            <div className="flex justify-between gap-3">
                                                <dt className="text-[var(--text-muted)]">{dict.collaborations.phone}</dt>
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
                                            {dict.collaborations.unlink}
                                        </Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}
