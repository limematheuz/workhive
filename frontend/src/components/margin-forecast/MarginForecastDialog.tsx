"use client";

import { ChartNoAxesCombined } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MarginForecastPanel } from "@/components/margin-forecast/MarginForecastPanel";
import type { MarginForecastScopeType } from "@/types/margin-forecast";

type MarginForecastDialogProps = {
    scopeType: MarginForecastScopeType;
    scopeId: number;
    scopeName: string;
    canManage: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function MarginForecastDialog({ scopeType, scopeId, scopeName, canManage, open, onOpenChange }: MarginForecastDialogProps) {
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl gap-0 overflow-hidden p-0"><DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 pr-14 sm:px-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent"><ChartNoAxesCombined className="size-5" aria-hidden="true" /></span><div><DialogTitle>Margen de la orden</DialogTitle><DialogDescription className="mt-1 truncate">{scopeName}</DialogDescription></div></div></DialogHeader><div className="max-h-[calc(92vh-8rem)] overflow-y-auto px-5 sm:px-6"><MarginForecastPanel scopeType={scopeType} scopeId={scopeId} canManage={canManage} /></div></DialogContent></Dialog>;
}
