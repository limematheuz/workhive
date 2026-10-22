"use client";

import { useState, type FormEvent } from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDictionary } from "@/lib/dictionary-context";
import { validateExpenseReceiptFile } from "@/lib/expense-receipt";
import type { Expense } from "@/types/expense";

type ExpenseReceiptDialogProps = {
    expense: Expense | null;
    uploading: boolean;
    onClose: () => void;
    onUpload: (file: File) => void;
};

export function ExpenseReceiptDialog({ expense, uploading, onClose, onUpload }: ExpenseReceiptDialogProps) {
    const { dict } = useDictionary();
    const text = dict.expenses;
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const close = () => {
        if (uploading) return;
        setFile(null);
        setError(null);
        onClose();
    };

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!file) return;
        const invalid = validateExpenseReceiptFile(file);
        if (invalid) {
            setError(text.receipt_validation[invalid]);
            return;
        }
        setError(null);
        onUpload(file);
    };

    return (
        <Dialog open={Boolean(expense)} onOpenChange={(open) => { if (!open) close(); }}>
            <DialogContent>
                <form onSubmit={submit} className="space-y-5">
                    <DialogHeader>
                        <DialogTitle>{text.receipt_upload}</DialogTitle>
                        <DialogDescription>{expense?.description} · {text.receipt_file_hint}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="expense-receipt-file">{text.receipt_choose}</Label>
                        <Input
                            id="expense-receipt-file"
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            disabled={uploading}
                            onChange={(event) => {
                                setFile(event.target.files?.[0] ?? null);
                                setError(null);
                            }}
                            aria-describedby={error ? "expense-receipt-error" : undefined}
                        />
                        {error && <p id="expense-receipt-error" role="alert" className="text-sm text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={uploading} onClick={close}>{text.receipt_cancel}</Button>
                        <Button type="submit" disabled={!file || uploading}>
                            <FileUp className="h-4 w-4" aria-hidden="true" />
                            {uploading ? text.receipt_uploading : text.receipt_upload}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
