"use client";

import { Building2 } from "lucide-react";

import {
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Client } from "@/services/client.service";

type ClientDetailDialogHeaderProps = {
    client: Client;
};

export function ClientDetailDialogHeader({ client }: ClientDetailDialogHeaderProps) {
    return (
        <DialogHeader className="p-4 sm:p-6 border-b border-[var(--border-soft)] flex-shrink-0 text-left">
            <div className="flex items-center gap-3 pr-12">
                <Building2 className="w-7 h-7 text-accent" />
                <div>
                    <DialogTitle className="text-xl font-black text-[var(--text-main)]">
                        {client.name}
                    </DialogTitle>
                    <DialogDescription className="text-2xs font-bold text-[var(--text-muted)] mt-0.5 tracking-wider uppercase font-mono">
                        NIF/CIF: {client.legal_number || "No informado"}
                    </DialogDescription>
                </div>
            </div>
        </DialogHeader>
    );
}
