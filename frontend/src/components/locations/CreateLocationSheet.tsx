"use client";

import { useState } from "react";
import { MapPinned, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import type { Client } from "@/services/client.service";
import { LocationService } from "@/services/location.service";
import { LocationWorkspaceForm, type LocationWorkspacePayload } from "./LocationWorkspaceForm";

interface CreateLocationSheetProps {
    clients: Client[];
    defaultClientId: number | "ALL";
    onLocationCreated?: () => void;
}

export function CreateLocationSheet({ clients, defaultClientId, onLocationCreated }: CreateLocationSheetProps) {
    const { dict } = useDictionary();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const createLocation = async (payload: LocationWorkspacePayload) => {
        try {
            setSubmitting(true);
            await LocationService.createLocation(payload);
            toast.success(dict.locations.form.success_toast);
            setOpen(false);
            onLocationCreated?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.locations.form.error_toast);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className={`${PAGE_ACTION_BUTTON_PRIMARY} w-full cursor-pointer md:w-auto`}>
                    <Plus className="h-4 w-4" />
                    {dict.locations.form.new_location}
                </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[min(92vh,980px)] w-[calc(100vw-1.5rem)] !max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-[24px] border border-[var(--border-soft)] p-0 sm:w-[calc(100vw-3rem)] sm:!max-w-[calc(100vw-3rem)] 2xl:!max-w-[1380px]">
                <DialogHeader className="shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-primary)] px-5 py-4 sm:px-7 sm:py-5">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"><MapPinned className="h-5 w-5" /></div>
                        <div>
                            <DialogTitle>Nueva ubicación</DialogTitle>
                    <DialogDescription>
                                Crea el local paso a paso. Solo pedimos lo necesario y podrás completar el resto cuando quieras.
                    </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                {open && (
                    <div className="min-h-0 flex-1 overflow-hidden">
                        <LocationWorkspaceForm
                            clients={clients}
                            defaultClientId={defaultClientId}
                            submitting={submitting}
                            submitLabel="Guardar ubicación"
                            onCancel={() => setOpen(false)}
                            onSubmit={createLocation}
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
