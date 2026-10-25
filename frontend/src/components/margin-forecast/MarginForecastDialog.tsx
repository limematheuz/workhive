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
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100vw-2rem)] max-w-3xl grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-3xl"><DialogHeader className="border-b border-[var(--border-soft)] px-5 py-5 pr-16 text-left sm:pl-6 sm:pr-16"><div className="flex min-w-0 items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent"><ChartNoAxesCombined className="size-5" aria-hidden="true" /></span><div className="min-w-0"><DialogTitle>Margen de la orden</DialogTitle><DialogDescription className="mt-1 truncate">{scopeName}</DialogDescription></div></div></DialogHeader><div className="min-h-0 min-w-0 overflow-y-auto px-5 sm:px-6"><MarginForecastPanel scopeType={scopeType} scopeId={scopeId} canManage={canManage} /></div></DialogContent></Dialog>;
}
