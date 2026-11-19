"use client";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function StaffDetailSurface({ split, title, children, close }: {
    split: boolean; title: string; children: ReactNode; close: () => void;
}) {
    if (split) return <aside className="max-h-[calc(100dvh-6rem)] min-w-0 overflow-y-auto rounded-xl border bg-card" aria-label={title}>{children}</aside>;
    return <Dialog open onOpenChange={open => { if (!open) close(); }}>
        <DialogContent confirmDiscard={false} showCloseButton={false} className="!m-0 !h-dvh !max-h-dvh !w-screen !max-w-none !gap-0 !rounded-none !border-0 !p-0 sm:!max-w-none">
            <DialogHeader className="sr-only"><DialogTitle>{title}</DialogTitle><DialogDescription>Consulta la ficha y vuelve al listado conservando tus filtros.</DialogDescription></DialogHeader>
            <div className="mx-auto w-full max-w-3xl">{children}</div>
        </DialogContent>
    </Dialog>;
}
