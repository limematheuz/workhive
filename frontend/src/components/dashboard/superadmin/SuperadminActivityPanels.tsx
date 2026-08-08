"use client";

import Link from "next/link";
import { ArrowRight, Building2, ClipboardList } from "lucide-react";

import {
    getCompanyAccessLabel,
    isCompanyAccessEnabled,
} from "@/components/companies/company-utils";
import { useDictionary } from "@/lib/dictionary-context";
import type { Company } from "@/types/company";
import type { TrialRequest } from "@/services/trial-request.service";

type SuperadminActivityPanelsProps = {
    companies: Company[];
    pendingRequests: TrialRequest[];
    loading?: boolean;
};

export function SuperadminActivityPanels({
    companies,
    pendingRequests,
    loading = false,
}: SuperadminActivityPanelsProps) {
    const { dict } = useDictionary();
    const text = dict.superadmin;

    return (
        <div className="grid gap-2.5 lg:grid-cols-2">
            <section className="billing-block rounded-[18px] border border-[var(--border-soft)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent">
                            <ClipboardList className="h-4 w-4" />
                        </span>
                        <h2 className="truncate text-sm font-bold text-[var(--text-main)]">
                            {text.section_pending}
                        </h2>
                    </div>
                    <Link
                        href="/dashboard/companies"
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                    >
                        {text.view_all}
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>

                {loading ? (
                    <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                        {text.loading}
                    </p>
                ) : pendingRequests.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--border-soft)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                        {text.no_pending}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {pendingRequests.map((request) => (
                            <li
                                key={request.id}
                                className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-3 py-2.5"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                                            {request.company_name}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                            {request.full_name} · {request.email}
                                        </p>
                                    </div>
                                    <span className="shrink-0 rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                                        {text.pending_badge}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="billing-block rounded-[18px] border border-[var(--border-soft)] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent">
                            <Building2 className="h-4 w-4" />
                        </span>
                        <h2 className="truncate text-sm font-bold text-[var(--text-main)]">
                            {text.section_companies}
                        </h2>
                    </div>
                    <Link
                        href="/dashboard/companies"
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                    >
                        {text.view_all}
                        <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>

                {loading ? (
                    <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                        {text.loading}
                    </p>
                ) : companies.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--border-soft)] px-3 py-6 text-center text-xs text-[var(--text-muted)]">
                        {text.no_companies}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {companies.map((company) => {
                            const accessLabel = getCompanyAccessLabel(
                                company,
                                text.access_active,
                                text.access_inactive,
                            );
                            const enabled = isCompanyAccessEnabled(company);
                            return (
                                <li
                                    key={company.id}
                                    className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] px-3 py-2.5"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                                                {company.name}
                                            </p>
                                            <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                                {company.email || company.contact_email || "—"}
                                            </p>
                                        </div>
                                        <span
                                            className={
                                                enabled
                                                    ? "shrink-0 rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent"
                                                    : "shrink-0 rounded-md border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--text-muted)]"
                                            }
                                        >
                                            {accessLabel}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </div>
    );
}
