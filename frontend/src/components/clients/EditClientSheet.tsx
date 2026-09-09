"use client";

import * as React from "react";

import { ClientFormFields } from "@/components/clients/ClientFormFields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import { ClientService, type Client } from "@/services/client.service";

interface EditClientSheetProps { client: Client | null; open: boolean; onOpenChange: (open: boolean) => void; onClientUpdated?: () => void; }

export function EditClientSheet({ client, open, onOpenChange, onClientUpdated }: EditClientSheetProps) {
    if (!client) return null;

    return <EditClientForm key={client.id} client={client} open={open} onOpenChange={onOpenChange} onClientUpdated={onClientUpdated} />;
}

type EditClientFormProps = Omit<EditClientSheetProps, "client"> & { client: Client };

function EditClientForm({ client, open, onOpenChange, onClientUpdated }: EditClientFormProps) {
    const { dict } = useDictionary();
    const [isLoading, setIsLoading] = React.useState(false);
    const [clientType, setClientType] = React.useState<Client["client_type"]>(client.client_type);
    const [relationshipStatus, setRelationshipStatus] = React.useState<NonNullable<Client["relationship_status"]>>(client.relationship_status ?? "client");
    const [isActive, setIsActive] = React.useState(client.is_active);
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); setIsLoading(true); const values = new FormData(event.currentTarget);
        try {
            await ClientService.updateClient(client.id, { name: String(values.get("name") || "").trim(), client_type: clientType, relationship_status: relationshipStatus, is_active: isActive, email: String(values.get("email") || "").trim() || null, phone: String(values.get("phone") || "").trim() || null, address: String(values.get("address") || "").trim(), city: String(values.get("city") || "").trim(), province: String(values.get("province") || "").trim() || null, postal_code: String(values.get("postal_code") || "").trim(), country: String(values.get("country") || "").trim(), legal_number: String(values.get("legal_number") || "").trim() || null });
            toast.success(dict.clients.form.update_success_toast); onOpenChange(false); onClientUpdated?.();
        } catch (error) { toast.error(error instanceof Error ? error.message : dict.clients.form.update_error_toast); } finally { setIsLoading(false); }
    };
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex max-h-[92vh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[56rem]"><form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col"><DialogHeader className="shrink-0 border-b border-[var(--border-soft)] px-5 py-5 text-left sm:px-7"><DialogTitle>{dict.clients.form.edit_title}</DialogTitle><DialogDescription>{dict.clients.form.edit_description}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7"><ClientFormFields idPrefix="edit-client" client={client} clientType={clientType} onClientTypeChange={setClientType} relationshipStatus={relationshipStatus} onRelationshipStatusChange={setRelationshipStatus} isActive={isActive} onActiveChange={setIsActive} /></div><footer className="flex shrink-0 justify-end gap-3 border-t border-[var(--border-soft)] px-5 py-4 sm:px-7"><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>{dict.clients.form.cancel}</Button><Button type="submit" disabled={isLoading}>{isLoading ? dict.clients.form.saving : dict.clients.form.save}</Button></footer></form></DialogContent></Dialog>;
}
