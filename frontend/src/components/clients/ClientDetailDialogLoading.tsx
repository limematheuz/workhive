"use client";

import { Loader2 } from "lucide-react";

type ClientDetailDialogLoadingProps = {
    message: string;
};

export function ClientDetailDialogLoading({ message }: ClientDetailDialogLoadingProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-main)]" />
            <span className="text-xs text-[var(--text-muted)] font-semibold">
                {message}
            </span>
        </div>
    );
}
