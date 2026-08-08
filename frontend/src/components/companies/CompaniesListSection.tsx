"use client";

import { Building2, ChevronDown, Loader2 } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { DataListTable } from "@/components/ui/data-list-table";
import type { Company } from "@/services/company.service";

import type { CompanyMember } from "./company-members";
import { CompanyMembersPanel } from "./CompanyMembersPanel";
import {
    getCompanyAccessBadgeClass,
    getCompanyAccessLabel,
    getCompanyContactEmail,
} from "./company-utils";

type CompaniesListSectionProps = {
    companies: Company[];
    emptyLabel: string;
    labels: {
        listTitle: string;
        listSubtitle: string;
        countOne: string;
        countMany: string;
        name: string;
        cif: string;
        email: string;
        phone: string;
        status: string;
        actions: string;
        active: string;
        inactive: string;
        viewTeam: string;
        admins: string;
        workers: string;
        noAdmins: string;
        noWorkers: string;
        memberInactive: string;
    };
    getCompanyActions: (company: Company) => PopoverOption[];
    expandedCompanyId: number | null;
    loadingCompanyId: number | null;
    membersByCompany: Record<number, CompanyMember[]>;
    onToggleMembers: (company: Company) => void;
};

const GRID =
    "grid-cols-[minmax(10rem,1.2fr)_minmax(7rem,.7fr)_minmax(11rem,1.2fr)_minmax(8rem,.75fr)_6.5rem_4.5rem]";

export function CompaniesListSection({
    companies,
    emptyLabel,
    labels,
    getCompanyActions,
    expandedCompanyId,
    loadingCompanyId,
    membersByCompany,
    onToggleMembers,
}: CompaniesListSectionProps) {
    const membersLabels = {
        admins: labels.admins,
        workers: labels.workers,
        noAdmins: labels.noAdmins,
        noWorkers: labels.noWorkers,
        inactive: labels.memberInactive,
    };

    const statusBadge = (company: Company) => (
        <Badge className={getCompanyAccessBadgeClass(company)}>
            {getCompanyAccessLabel(company, labels.active, labels.inactive)}
        </Badge>
    );

    const nameCell = (company: Company) => {
        const expanded = expandedCompanyId === company.id;
        return (
            <button
                type="button"
                onClick={() => onToggleMembers(company)}
                aria-expanded={expanded}
                title={labels.viewTeam}
                className="flex min-w-0 items-center gap-2 text-left"
            >
                {loadingCompanyId === company.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
                ) : (
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 text-accent transition ${expanded ? "rotate-180" : ""}`}
                        aria-hidden="true"
                    />
                )}
                <Building2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="truncate text-sm font-semibold text-[var(--text-main)]">
                    {company.name}
                </span>
            </button>
        );
    };

    const expandedPanel = (company: Company) => {
        if (expandedCompanyId !== company.id) return null;
        return (
            <div className="col-span-full border-t border-[var(--border-soft)] pt-2.5">
                <CompanyMembersPanel
                    members={membersByCompany[company.id] || []}
                    labels={membersLabels}
                />
            </div>
        );
    };

    return (
        <DataListTable
            items={companies}
            getRowKey={(company) => company.id}
            gridClassName={GRID}
            desktopFrom="lg"
            header={{
                title: labels.listTitle,
                subtitle: labels.listSubtitle,
                countLabel: `${companies.length} ${companies.length === 1 ? labels.countOne : labels.countMany}`,
            }}
            columns={[
                { key: "name", label: labels.name },
                { key: "cif", label: labels.cif },
                { key: "email", label: labels.email },
                { key: "phone", label: labels.phone },
                { key: "status", label: labels.status },
                { key: "actions", label: labels.actions, className: "text-right" },
            ]}
            empty={(
                <>
                    <Building2 className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{emptyLabel}</p>
                </>
            )}
            renderCompactRow={(company) => (
                <>
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                {nameCell(company)}
                                {statusBadge(company)}
                            </div>
                            <span className="block font-mono text-[11px] text-[var(--text-muted)]">
                                {company.tax_id || company.cif || "—"}
                            </span>
                        </div>
                        <ActionPopover
                            align="end"
                            options={getCompanyActions(company)}
                        />
                    </div>
                    <div className="mt-2.5 space-y-1 border-t border-[var(--border-soft)] pt-2.5 text-xs text-[var(--text-muted)]">
                        {getCompanyContactEmail(company) && (
                            <p className="truncate">
                                <span className="font-medium text-[var(--text-main)]">{labels.email}: </span>
                                {getCompanyContactEmail(company)}
                            </p>
                        )}
                        {company.phone && (
                            <p>
                                <span className="font-medium text-[var(--text-main)]">{labels.phone}: </span>
                                {company.phone}
                            </p>
                        )}
                    </div>
                    {expandedCompanyId === company.id && (
                        <div className="mt-2.5 border-t border-[var(--border-soft)] pt-2.5">
                            <CompanyMembersPanel
                                members={membersByCompany[company.id] || []}
                                labels={membersLabels}
                            />
                        </div>
                    )}
                </>
            )}
            renderDesktopRow={(company) => (
                <>
                    {nameCell(company)}
                    <p className="min-w-0 truncate font-mono text-xs text-[var(--text-muted)]">
                        {company.tax_id || company.cif || "—"}
                    </p>
                    <p className="min-w-0 truncate text-sm text-[var(--text-muted)]">
                        {getCompanyContactEmail(company) || "—"}
                    </p>
                    <p className="min-w-0 truncate text-sm text-[var(--text-muted)]">
                        {company.phone || "—"}
                    </p>
                    <div className="flex items-center">{statusBadge(company)}</div>
                    <div className="flex items-center justify-end">
                        <ActionPopover align="end" options={getCompanyActions(company)} />
                    </div>
                    {expandedPanel(company)}
                </>
            )}
        />
    );
}
