"use client";
import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClientService, type Client } from "@/services/client.service";
export function LeadAccountForm({ close, saved }: {
    close: () => void;
    saved: (client: Client) => void;
}) {
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setBusy(true);
        try {
            const value = (key: string) => String(form.get(key) ?? "").trim();
            const client = await ClientService.createClient({ name: value("name"), client_type: "business", relationship_status: "lead", address: value("address"), city: value("city"), postal_code: value("postal_code"), country: value("country"), email: value("email") || null, phone: value("phone") || null });
            saved(client);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo guardar el lead.");
        } finally {
            setBusy(false);
        }
    }
    return <Dialog open onOpenChange={v => { if (!v && !busy)
        close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Nuevo lead</DialogTitle><DialogDescription>Se guardará como contacto potencial en Clientes y podrás crear su primera oportunidad.</DialogDescription></DialogHeader>
 <form onSubmit={event => void handleSubmit(event)} className="space-y-4"><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Nombre del contacto o empresa<Input required name="name" maxLength={100}/></label><label className="text-sm">Correo<Input name="email" type="email"/></label><label className="text-sm">Teléfono<Input name="phone" maxLength={20}/></label><label className="text-sm sm:col-span-2">Dirección<Input required name="address" maxLength={255}/></label><label className="text-sm">Ciudad<Input required name="city" maxLength={100}/></label><label className="text-sm">Código postal<Input required name="postal_code" maxLength={10}/></label><label className="text-sm">País<Input required name="country" maxLength={100}/></label><div className="flex justify-end gap-2 border-t pt-3 sm:col-span-2"><Button type="button" variant="outline" onClick={close}>Cancelar</Button><Button>Guardar lead</Button></div></fieldset>{error && <p role="alert" className="text-sm text-orange-700">{error}</p>}</form></DialogContent></Dialog>;
}
