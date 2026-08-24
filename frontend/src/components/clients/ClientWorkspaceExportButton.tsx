"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildClientWorkspaceCsv, type ClientWorkspaceRow } from "@/lib/client-workspace";

type ClientWorkspaceExportButtonProps = {
    rows: ClientWorkspaceRow[];
    includeFinancialData: boolean;
    year: number;
};

export function ClientWorkspaceExportButton({ rows, includeFinancialData, year }: ClientWorkspaceExportButtonProps) {
    const exportClients = () => {
        const blob = new Blob([`\uFEFF${buildClientWorkspaceCsv(rows, { includeFinancialData, year })}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `clientes-${year}.csv`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Button type="button" variant="outline" size="sm" onClick={exportClients} disabled={rows.length === 0}>
            <Download aria-hidden="true" /> Exportar
        </Button>
    );
}
