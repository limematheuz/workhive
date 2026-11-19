"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinanceLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-400/40 bg-orange-400/5 p-4 text-sm">
        <AlertCircle className="size-5 shrink-0 text-orange-500" aria-hidden="true" />
        <p className="min-w-0 flex-1">{message}</p>
        <Button type="button" variant="secondary" size="sm" onClick={onRetry}>Volver a intentar</Button>
    </div>;
}
