"use client";

import { Pencil, Power, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Client } from "@/services/client.service";

type ClientDetailManageActionsProps = {
    client: Client;
    onEditClient?: (client: Client) => void;
    onToggleActiveClient?: (client: Client) => void;
    onDeleteClient?: (client: Client) => void;
    onClose: () => void;
};

export function ClientDetailManageActions({
    client,
    onEditClient,
    onToggleActiveClient,
    onDeleteClient,
    onClose,
}: ClientDetailManageActionsProps) {
    return (
        <div className="dialog-glass-chrome flex flex-col-reverse gap-2 border-t border-[var(--border-soft)] p-4 sm:flex-row sm:justify-end sm:p-5">
            {onEditClient && (
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                        onClose();
                        onEditClient(client);
                    }}
                    className="h-9 rounded-xl px-4 text-2xs font-black uppercase"
                >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                </Button>
            )}
            {onToggleActiveClient && (
                <Button
                    type="button"
                    size="sm"
                    variant={client.is_active ? "destructive" : "secondary"}
                    onClick={() => onToggleActiveClient(client)}
                    className={`h-9 rounded-xl px-4 text-2xs font-black uppercase ${
                        client.is_active ? "btn-app-danger-soft" : "btn-app-secondary"
                    }`}
                >
                    <Power className="h-3.5 w-3.5" />
                    {client.is_active ? "Desactivar" : "Activar"}
                </Button>
            )}
            {onDeleteClient && (
                <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                        onClose();
                        onDeleteClient(client);
                    }}
                    className="h-9 rounded-xl px-4 text-2xs font-black uppercase"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                </Button>
            )}
        </div>
    );
}
