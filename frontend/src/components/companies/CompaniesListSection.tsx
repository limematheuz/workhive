"use client";

import { Fragment } from "react";
import { Building2, ChevronDown, Loader2 } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    getCompanyContactEmail,
} from "./company-utils";

type CompaniesListSectionProps = {
    companies: Company[];
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
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

const PAGE_SIZES = [10, 25, 50] as const;

export function CompaniesListSection({
    companies,
    total,
    page,
    pageSize,
    onPageChange,
    onPageSizeChange,
    emptyLabel,
    labels,
    getCompanyActions,
    expandedCompanyId,
    loadingCompanyId,
    membersByCompany,
    onToggleMembers,
}: CompaniesListSectionProps) {
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
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
            <Button
                type="button"
                variant="ghost"
                className="h-auto min-w-0 justify-start gap-2 p-0 text-left font-normal shadow-none hover:bg-transparent hover:text-[var(--text-main)] hover:shadow-none"
                onClick={() => onToggleMembers(company)}
                aria-expanded={expanded}
                aria-label={`${labels.viewTeam}: ${company.name}`}
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
                <span className="truncate text-sm font-semibold text-[var(--text-main)]">{company.name}</span>
            </Button>
        );
    };

    const renderMembers = (company: Company) => (
        <CompanyMembersPanel
            members={membersByCompany[company.id] || []}
            labels={membersLabels}
        />
    );

    const changePage = (event: React.MouseEvent<HTMLAnchorElement>, nextPage: number) => {
        event.preventDefault();
        if (nextPage >= 1 && nextPage <= pageCount && nextPage !== page) onPageChange(nextPage);
    };

    return (
        <section className="billing-surface overflow-hidden rounded-[26px]" aria-label={labels.listTitle}>
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-main)]">{labels.listTitle}</h2>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{labels.listSubtitle}</p>
                </div>
                <Badge className="w-fit border-accent/25 bg-accent/10 text-[10px] font-semibold uppercase text-accent">
                    {total} {total === 1 ? labels.countOne : labels.countMany}
                </Badge>
            </div>

            {companies.length === 0 ? (
                <div className="border-t border-[var(--border-soft)] px-5 py-12 text-center">
                    <Building2 className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{emptyLabel}</p>
                </div>
            ) : (
                <>
                    <div className="hidden overflow-x-auto border-t border-[var(--border-soft)] p-3 md:block">
                        <Table className="min-w-[760px] table-fixed text-left">
                            <TableHeader>
                                <TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]/40">
                                    <TableHead>{labels.name}</TableHead>
                                    <TableHead>{labels.cif}</TableHead>
                                    <TableHead>{labels.email}</TableHead>
                                    <TableHead>{labels.phone}</TableHead>
                                    <TableHead>{labels.status}</TableHead>
                                    <TableHead className="text-right">{labels.actions}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {companies.map((company) => (
                                    <Fragment key={company.id}>
                                        <TableRow
                                            className="bg-[var(--bg-secondary)]/20 hover:bg-[var(--bg-secondary)]/55"
                                        >
                                            <TableCell>{nameCell(company)}</TableCell>
                                            <TableCell className="font-mono text-xs text-[var(--text-muted)]">{company.tax_id || company.cif || "—"}</TableCell>
                                            <TableCell className="max-w-56 truncate text-sm text-[var(--text-muted)]">{getCompanyContactEmail(company) || "—"}</TableCell>
                                            <TableCell className="text-sm text-[var(--text-muted)]">{company.phone || "—"}</TableCell>
                                            <TableCell>{statusBadge(company)}</TableCell>
                                            <TableCell className="text-right"><ActionPopover align="end" triggerLabel={labels.actions} options={getCompanyActions(company)} /></TableCell>
                                        </TableRow>
                                        {expandedCompanyId === company.id && (
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell colSpan={6} className="bg-[var(--bg-secondary)] px-5 py-3">{renderMembers(company)}</TableCell>
                                            </TableRow>
                                        )}
                                    </Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="space-y-2.5 p-3 md:hidden">
                        {companies.map((company) => (
                            <article
                                key={company.id}
                                className="billing-block rounded-2xl p-3"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {nameCell(company)}
                                            {statusBadge(company)}
                                        </div>
                                        <p className="font-mono text-[11px] text-[var(--text-muted)]">{company.tax_id || company.cif || "—"}</p>
                                    </div>
                                    <ActionPopover align="end" triggerLabel={labels.actions} options={getCompanyActions(company)} />
                                </div>
                                <div className="mt-3 space-y-1 border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-muted)]">
                                    {getCompanyContactEmail(company) && <p className="truncate">{getCompanyContactEmail(company)}</p>}
                                    {company.phone && <p>{company.phone}</p>}
                                </div>
                                {expandedCompanyId === company.id && <div className="mt-3 border-t border-[var(--border-soft)] pt-3">{renderMembers(company)}</div>}
                            </article>
                        ))}
                    </div>
                </>
            )}

            {total > 0 && (
                <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                        <Label className="whitespace-nowrap" htmlFor="companies-page-size">Filas por página</Label>
                        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                            <SelectTrigger id="companies-page-size" className="h-9 w-20"><SelectValue /></SelectTrigger>
                            <SelectContent align="start">
                                {PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Pagination className="mx-0 w-auto">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#companies-list"
                                    aria-label="Página anterior"
                                    iconOnly
                                    aria-disabled={page === 1}
                                    className={page === 1 ? "h-9 w-9 p-0 pointer-events-none opacity-50" : "h-9 w-9 p-0"}
                                    onClick={(event) => changePage(event, page - 1)}
                                />
                            </PaginationItem>
                            <PaginationItem>
                                <PaginationNext
                                    href="#companies-list"
                                    aria-label="Página siguiente"
                                    iconOnly
                                    aria-disabled={page === pageCount}
                                    className={page === pageCount ? "h-9 w-9 p-0 pointer-events-none opacity-50" : "h-9 w-9 p-0"}
                                    onClick={(event) => changePage(event, page + 1)}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}
        </section>
    );
}
