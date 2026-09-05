"use client";

import type { ComponentProps } from "react";
import { BriefcaseBusiness, Receipt } from "lucide-react";

import { InvoiceableJobsSection } from "@/components/invoices/InvoiceableJobsSection";
import { InvoicesFiltersBar } from "@/components/invoices/InvoicesFiltersBar";
import { InvoicesListSection } from "@/components/invoices/InvoicesListSection";
import { PremiumTabs } from "@/components/ui/premium-tabs";

type InvoicesTabPanelsProps = {
    activeView: "invoices" | "jobs";
    onActiveViewChange: (view: "invoices" | "jobs") => void;
    tabLabels: {
        tab_invoices?: string;
        tab_jobs?: string;
    };
    filtersProps: ComponentProps<typeof InvoicesFiltersBar>;
    jobsProps: ComponentProps<typeof InvoiceableJobsSection>;
    listProps: ComponentProps<typeof InvoicesListSection>;
    canManage: boolean;
};

export function InvoicesTabPanels({
    activeView,
    onActiveViewChange,
    tabLabels,
    filtersProps,
    jobsProps,
    listProps,
    canManage,
}: InvoicesTabPanelsProps) {
    return (
        <>
            <PremiumTabs
                layout="fit"
                tabs={[
                    { id: "invoices" as const, label: tabLabels.tab_invoices || "Facturas", icon: Receipt },
                    ...(canManage ? [{ id: "jobs" as const, label: tabLabels.tab_jobs || "Trabajos hechos", icon: BriefcaseBusiness }] : []),
                ]}
                activeTab={activeView}
                onChange={onActiveViewChange}
            />

            {activeView === "invoices" && <InvoicesFiltersBar {...filtersProps} />}

            {activeView === "jobs" ? (
                <InvoiceableJobsSection {...jobsProps} />
            ) : (
                <InvoicesListSection {...listProps} />
            )}
        </>
    );
}
