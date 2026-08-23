"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Location } from "@/services/location.service";
import { LocationTasksWorkspace } from "./LocationTasksWorkspace";

interface LocationTasksSheetProps {
    location: Location | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialCreateForm?: boolean;
    initialTab?: "history" | "templates" | "spaces";
    readOnly?: boolean;
}

export function LocationTasksSheet({ location, open, onOpenChange, initialCreateForm, initialTab, readOnly }: LocationTasksSheetProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-6 pb-4 pt-6">
                    <DialogTitle className="text-xl font-bold">Configuración de la ubicación</DialogTitle>
                    <DialogDescription className="text-sm font-semibold text-[var(--text-muted)]">{location?.name} ({location?.city})</DialogDescription>
                </DialogHeader>
                <LocationTasksWorkspace location={location} open={open} initialCreateForm={initialCreateForm} initialTab={initialTab} readOnly={readOnly} className="min-h-0 px-6 pb-6 pt-4" />
            </DialogContent>
        </Dialog>
    );
}
