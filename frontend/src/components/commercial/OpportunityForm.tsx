"use client";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { FormSelect } from "@/components/ui/form-select";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ClientService, type ClientOpportunityOwner } from "@/services/client.service";
import { searchCommercialAccounts, type CommercialAccount, type CommercialOpportunity } from "@/services/commercial-workspace.service";
import { opportunityStages, commercialLocalInput } from "@/lib/commercial-format";
import type { ClientOpportunityStage } from "@/types/client";
export function OpportunityForm({ item, initialAccount, close, saved }: {
    item: CommercialOpportunity | null;
    initialAccount?: CommercialAccount | null;
    close: () => void;
    saved: () => void;
}) {
    const [client, setClient] = useState(() => String(item?.client_id ?? initialAccount?.id ?? "")), [search, setSearch] = useState(""), [accounts, setAccounts] = useState<CommercialAccount[]>([]), [owners, setOwners] = useState<ClientOpportunityOwner[]>([]);
    const [title, setTitle] = useState(item?.title ?? ""), [stage, setStage] = useState<ClientOpportunityStage>(item?.stage ?? "new"), [owner, setOwner] = useState(() => String(item?.owner_membership_id ?? "")), [date, setDate] = useState(() => commercialLocalInput(item?.next_follow_up_at ?? null)), [loss, setLoss] = useState(item?.loss_reason ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
    useEffect(() => { let active = true; if (item)
        return; const timer = window.setTimeout(() => { searchCommercialAccounts(search).then(rows => { if (active)
        setAccounts(rows); }).catch(e => { if (active)
        setError(e.message); }); }, 200); return () => { active = false; window.clearTimeout(timer); }; }, [search, item]);
    useEffect(() => { let active = true; if (client)
        ClientService.getClientOpportunityOwners(Number(client)).then(rows => { if (active)
            setOwners(rows); }).catch(e => { if (active)
            setError(e.message); }); return () => { active = false; }; }, [client]);
    const choices = initialAccount && !accounts.some(row => row.id === initialAccount.id) ? [initialAccount, ...accounts] : accounts;
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const body = { title, stage, owner_membership_id: owner ? Number(owner) : null, contact_id: item?.contact_id ?? null, next_follow_up_at: date ? new Date(date).toISOString() : null, loss_reason: stage === "lost" ? loss : null };
            if (item)
                await ClientService.updateClientOpportunity(item.client_id, item.id, body);
            else
                await ClientService.createClientOpportunity(Number(client), body);
            saved();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo guardar.");
        } finally {
            setBusy(false);
        }
    }
    return <Dialog open onOpenChange={v => { if (!v && !busy)
        close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{item ? "Editar oportunidad" : "Nueva oportunidad"}</DialogTitle><DialogDescription>Cliente o lead, siguiente paso y responsable. El historial conserva los cambios de fase.</DialogDescription></DialogHeader>
 <form className="space-y-4" onSubmit={event => void handleSubmit(event)}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
 {item ? <p className="text-sm font-medium sm:col-span-2">{item.client_name}</p> : <label className="text-sm sm:col-span-2">Cliente o lead<SearchableSelect aria-label="Cliente o lead" required value={client} onValueChange={value => { setClient(value); setOwner(""); setOwners([]); }} options={choices.map(account => ({ value: String(account.id), label: account.name, description: account.relationship_status === "lead" ? "Lead" : "Cliente" }))} onSearchChange={setSearch} placeholder="Buscar cliente o lead" /></label>}
 <label className="text-sm sm:col-span-2">Oportunidad<Input required maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Limpieza de oficinas de la sede norte"/></label><label className="text-sm">Fase<FormSelect aria-label="Fase de la oportunidad" className="staff-select" value={stage} onValueChange={e => setStage(e as ClientOpportunityStage)}>{Object.entries(opportunityStages).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</FormSelect></label><label className="text-sm">Responsable<FormSelect aria-label="Responsable" className="staff-select" value={owner} onValueChange={e => setOwner(e)}><option value="">Pendiente de asignar</option>{owners.map(person => <option key={person.membership_id} value={person.membership_id}>{person.full_name}</option>)}</FormSelect></label>
 <label className="text-sm sm:col-span-2">Próximo seguimiento (hora de tu dispositivo)<DateTimePicker id="commercial-next-follow-up" clearable aria-label="Fecha del próximo seguimiento" value={date || null} onValueChange={v => setDate(v ?? "")}/></label>{stage === "lost" && <label className="text-sm sm:col-span-2">Motivo de pérdida<Textarea required maxLength={500} value={loss} onChange={e => setLoss(e.target.value)}/></label>}
 <div className="flex justify-end gap-2 border-t pt-3 sm:col-span-2"><Button type="button" variant="outline" onClick={close}>Cancelar</Button><Button>Guardar oportunidad</Button></div></fieldset>{error && <p role="alert" className="text-sm text-orange-700">{error}</p>}</form></DialogContent></Dialog>;
}
