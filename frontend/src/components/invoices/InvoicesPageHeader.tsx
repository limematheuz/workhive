"use client";

import { Plus, Receipt } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";

type InvoicesPageHeaderProps = {
    title: string;
    subtitle: string;
    newInvoiceLabel: string;
    onCreateInvoice: () => void;
    canManage: boolean;
};

export function InvoicesPageHeader({
    title,
    subtitle,
    newInvoiceLabel,
    onCreateInvoice,
    canManage,
}: InvoicesPageHeaderProps) {
    return (
        <PageHeader
            icon={Receipt}
            title={title}
            subtitle={subtitle}
            className="mb-6"
            actions={canManage ? (
                <Button
                    type="button"
                    onClick={onCreateInvoice}
                    className={PAGE_ACTION_BUTTON_PRIMARY}
                >
                    <Plus className="h-4 w-4" />
                    {newInvoiceLabel}
                </Button>
            ) : undefined}
        />
    );
}
