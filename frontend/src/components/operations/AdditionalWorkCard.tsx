"use client";
import {FormSelect} from "@/components/ui/form-select";
import {useUser} from "@/lib/user-context";
import {canManageFinance} from "@/domain/access/roles";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { saveAdditionalWork, type AdditionalWork } from "@/services/additional-work.service";
import type { Quote } from "@/types/quote";
import type { Location } from "@/services/location.service";
export function AdditionalWorkCard({ item, quotes, location, saved }: {
    item: AdditionalWork;
    quotes: Quote[];
    location?: Location;
    saved: () => void;
}) {
    const {user}=useUser();
    const [quoteId, setQuoteId] = useState(String(item.quote_id ?? ""));
    const [start, setStart] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(action: "quote" | "schedule") {
        setBusy(true);
        setError("");
        try {
            await saveAdditionalWork(item.id, action, action === "quote"
                ? { quote_id: Number(quoteId) } : { starts_at: new Date(start).toISOString() });
            saved();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
        }
        finally {
            setBusy(false);
        }
    }
    return <article className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex justify-between gap-2"><div><h2 className="font-semibold">{item.title}</h2><p className="text-sm text-muted-foreground">{location?.name} · {item.description}</p></div>
            <span className={item.stage === "Facturado" ? "text-green-700" : "text-orange-700 dark:text-orange-300"}>{item.stage}</span></div>
        <div className="flex flex-wrap gap-3 text-sm">
            {item.quote_id && <Link className="underline" href={"/dashboard/quotes/" + item.quote_id}>Abrir presupuesto</Link>}
            {item.contract_id && <Link className="underline" href={"/dashboard/contracts?quote=" + item.quote_id}>Preparar contrato y ubicación</Link>}
            {item.task_id && <Link className="underline" href={"/dashboard?taskId=" + item.task_id}>Abrir trabajo</Link>}
            {item.stage === "Pendiente de facturar" && <Link className="underline" href="/dashboard/invoices">Crear factura del trabajo</Link>}
        </div>
        {canManageFinance(user)&&!item.task_id && <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">Presupuesto del cliente<FormSelect aria-label={"Presupuesto del cliente"} className="block h-9 max-w-80 rounded-md border bg-background px-2" value={quoteId} onValueChange={selectedOptionValue=>setQuoteId(selectedOptionValue)}>
                <option value="">Seleccionar presupuesto</option>{quotes.filter(q => q.client_id === location?.client_id).map(q => <option key={q.id} value={q.id}>{q.quote_number} · {q.title}</option>)}
            </FormSelect></label>
            <Button disabled={busy || !quoteId} variant="outline" onClick={() => void submit("quote")}>Vincular presupuesto</Button>
            {item.stage === "Aceptado" && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void submit("schedule"); }}>
                <label className="text-sm">Inicio del trabajo<DateTimePicker aria-label="Inicio del trabajo adicional" id={"extra-start-" + item.id} value={start || null} onValueChange={v => setStart(v ?? "")}/></label>
                <Button disabled={busy || !start}>Programar trabajo</Button>
            </form>}
        </div>}
        {error && <p role="alert" className="text-orange-700 dark:text-orange-300">{error}</p>}
    </article>;
}
