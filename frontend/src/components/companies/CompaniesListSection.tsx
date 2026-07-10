"use client";

import { Fragment } from "react";
import { Building2, ChevronDown, Loader2, MoreVertical, Users } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import type { Company } from "@/services/company.service";
import type { CompanyMember } from "./company-members";
import { CompanyMembersPanel } from "./CompanyMembersPanel";

import {
    getCompanyAccessBadgeClass,
    getCompanyAccessLabel,
} from "./company-utils";

type CompaniesListSectionProps = {
    companies: Company[];
    emptyLabel: string;
    labels: {
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
    if (companies.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-soft)] text-center shadow-sm">
                <Building2 className="h-12 w-12 text-[var(--text-muted)] mb-4" />
                <p className="text-[var(--text-muted)] text-sm">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <>
            <div className="lg:hidden space-y-3">
                {companies.map((company) => (
                    <div
                        key={company.id}
                        className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-4 space-y-3 shadow-sm"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5">
                                        <Building2 className="h-4 w-4 text-accent shrink-0" />
                                        {company.name}
                                    </span>
                                    <Badge className={getCompanyAccessBadgeClass(company)}>
                                        {getCompanyAccessLabel(company, labels.active, labels.inactive)}
                                    </Badge>
                                </div>
                                <span className="text-2xs font-mono text-[var(--text-muted)] mt-0.5 block">
                                    {company.tax_id || company.cif || "—"}
                                </span>
                            </div>
                            <ActionPopover
                                options={getCompanyActions(company)}
                                trigger={
                                    <button
                                        type="button"
                                        aria-label={`Acciones de ${company.name}`}
                                        className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]"
                                    >
                                        <MoreVertical className="h-4 w-4" />
                                    </button>
                                }
                            />
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-[var(--border-soft)]/50 text-xs text-[var(--text-muted)]">
                            {company.email && (
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-[var(--text-main)]">Email:</span>
                                    <span className="truncate">{company.email}</span>
                                </div>
                            )}
                            {company.phone && (
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-[var(--text-main)]">Teléfono:</span>
                                    <span>{company.phone}</span>
                                </div>
                            )}
                            {company.address && (
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-[var(--text-main)]">Dirección:</span>
                                    <span className="truncate">{company.address}</span>
                                </div>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggleMembers(company)}
                            aria-expanded={expandedCompanyId === company.id}
                            className="flex w-full items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold text-[var(--text-main)]"
                        >
                            <span className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-accent" />
                                {labels.viewTeam}
                            </span>
                            {loadingCompanyId === company.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ChevronDown className={`h-4 w-4 transition ${expandedCompanyId === company.id ? "rotate-180" : ""}`} />
                            )}
                        </button>
                        {expandedCompanyId === company.id && (
                            <CompanyMembersPanel
                                members={membersByCompany[company.id] || []}
                                labels={{
                                    admins: labels.admins,
                                    workers: labels.workers,
                                    noAdmins: labels.noAdmins,
                                    noWorkers: labels.noWorkers,
                                    inactive: labels.memberInactive,
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="hidden lg:block bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm w-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{labels.name}</TableHead>
                            <TableHead>{labels.cif}</TableHead>
                            <TableHead className="hidden md:table-cell">{labels.email}</TableHead>
                            <TableHead className="hidden md:table-cell">{labels.phone}</TableHead>
                            <TableHead>{labels.status}</TableHead>
                            <TableHead className="text-right">{labels.actions}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {companies.map((company) => (
                            <Fragment key={company.id}>
                            <TableRow>
                                <TableCell className="font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => onToggleMembers(company)}
                                        aria-expanded={expandedCompanyId === company.id}
                                        className="flex items-center gap-2 text-left"
                                        title={labels.viewTeam}
                                    >
                                        {loadingCompanyId === company.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-accent" />
                                        ) : (
                                            <ChevronDown className={`h-4 w-4 text-accent transition ${expandedCompanyId === company.id ? "rotate-180" : ""}`} />
                                        )}
                                        <Building2 className="h-4 w-4 text-accent" />
                                        {company.name}
                                    </button>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{company.tax_id || company.cif || "—"}</TableCell>
                                <TableCell className="hidden md:table-cell text-[var(--text-muted)]">{company.email || "—"}</TableCell>
                                <TableCell className="hidden md:table-cell text-[var(--text-muted)]">{company.phone || "—"}</TableCell>
                                <TableCell>
                                    <Badge className={getCompanyAccessBadgeClass(company)}>
                                        {getCompanyAccessLabel(company, labels.active, labels.inactive)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <ActionPopover options={getCompanyActions(company)} />
                                </TableCell>
                            </TableRow>
                            {expandedCompanyId === company.id && (
                                <TableRow>
                                    <TableCell colSpan={6} className="p-3">
                                        <CompanyMembersPanel
                                            members={membersByCompany[company.id] || []}
                                            labels={{
                                                admins: labels.admins,
                                                workers: labels.workers,
                                                noAdmins: labels.noAdmins,
                                                noWorkers: labels.noWorkers,
                                                inactive: labels.memberInactive,
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            )}
                            </Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
