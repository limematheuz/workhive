"use client";

import { useState } from "react";
import { AlertCircle, FileSpreadsheet, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDictionary } from "@/lib/dictionary-context";
import type { SalesLedgerCsvPreview } from "@/services/sales-ledger.service";

type SalesLedgerImportDialogProps = {
    open: boolean;
    busy: boolean;
    onOpenChange: (open: boolean) => void;
    onPreview: (file: File) => Promise<SalesLedgerCsvPreview>;
    onImport: (file: File) => Promise<void>;
};

export function SalesLedgerImportDialog({ open, busy, onOpenChange, onPreview, onImport }: SalesLedgerImportDialogProps) {
    const { dict } = useDictionary();
    const copy = dict.invoices;
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<SalesLedgerCsvPreview | null>(null);
    const [previewing, setPreviewing] = useState(false);

    const reset = () => {
        setFile(null);
        setPreview(null);
    };

    const selectFile = async (nextFile: File | null) => {
        setFile(nextFile);
        setPreview(null);
        if (!nextFile) return;
        setPreviewing(true);
        try {
            setPreview(await onPreview(nextFile));
        } catch {
            setPreview(null);
        } finally {
            setPreviewing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!busy) onOpenChange(nextOpen);
            if (!nextOpen) reset();
        }}>
            <DialogContent className="w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-lg">
                <DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 pr-14 sm:px-6">
                    <DialogTitle className="flex items-center gap-2.5 text-lg sm:text-xl">
                        <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent"><FileSpreadsheet className="size-4" /></span>
                        {copy.ledger_import_csv}
                    </DialogTitle>
                    <DialogDescription>{copy.ledger_import_description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 px-5 py-5 sm:px-6">
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 ui-motion hover:border-accent">
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--text-main)]">{file?.name ?? copy.ledger_select_csv}</span>
                            <span className="mt-1 block text-xs text-[var(--text-muted)]">{copy.ledger_csv_columns}</span>
                        </span>
                        <Upload className="size-5 shrink-0 text-accent" />
                        <Input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void selectFile(event.target.files?.[0] ?? null)} />
                    </label>

                    {previewing && <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]"><Loader2 className="size-4 animate-spin" />{copy.ledger_validating_csv}</p>}
                    {preview && (
                        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-4">
                            <p className="text-sm font-semibold text-[var(--text-main)]">{copy.ledger_valid_rows.replace("{count}", String(preview.valid_rows))}</p>
                            {preview.errors.length > 0 && (
                                <ul className="mt-3 space-y-1.5 text-xs text-[var(--btn-cancel-text)]">
                                    {preview.errors.slice(0, 5).map((error) => <li key={`${error.row}-${error.message}`} className="flex gap-2"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{copy.ledger_csv_row_error.replace("{row}", String(error.row)).replace("{message}", error.message)}</li>)}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="dialog-glass-chrome border-t border-[var(--border-soft)] px-5 py-4 sm:px-6">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{copy.cancel}</Button>
                    <Button type="button" disabled={!file || !preview || preview.errors.length > 0 || previewing || busy} onClick={() => file && void onImport(file)}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        {busy ? copy.ledger_importing_csv : copy.ledger_import_csv}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
