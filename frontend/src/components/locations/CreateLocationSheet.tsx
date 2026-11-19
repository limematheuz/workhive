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
            <DialogContent className="wh-location-dialog flex flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="wh-location-dialog-header shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-primary)] pr-16 text-left">
                    <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><MapPinned className="size-4" /></div>
                        <div className="min-w-0">
                            <DialogTitle>Nueva ubicación</DialogTitle>
                    <DialogDescription>
                                Configura la ubicación, sus espacios y sus tareas paso a paso.
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
