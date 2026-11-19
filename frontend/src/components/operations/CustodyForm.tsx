"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { writeResourceLog } from "@/services/resource-log.service";
import type { Employee } from "@/services/staff.service";
import type { LocationEquipmentLibraryItem } from "@/services/location.service";
export function CustodyForm({ assets, staff, saved }: {
    assets: LocationEquipmentLibraryItem[];
    staff: Pick<Employee, "id" | "name">[];
    saved: () => void;
}) {
    const [asset, setAsset] = useState("");
    const [person, setPerson] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            await writeResourceLog("custody", { equipment_id: Number(asset), employee_id: Number(person), notes });
            saved();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo registrar la entrega.");
        } finally {
            setBusy(false);
        }
    }
    return <form className="flex flex-wrap items-end gap-3 rounded-lg border p-3" onSubmit={event => void handleSubmit(event)}>
        <label>Material o llave<FormSelect aria-label={"Material o llave"} required  value={asset} onValueChange={selectedOptionValue=>setAsset(selectedOptionValue)}><option value="">Seleccionar</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</FormSelect></label>
        <label>Entregado a<FormSelect aria-label={"Entregado a"} required  value={person} onValueChange={selectedOptionValue=>setPerson(selectedOptionValue)}><option value="">Seleccionar</option>{staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</FormSelect></label>
        <label>Observaciones<Input value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)}/></label>
        <Button disabled={busy}>Registrar entrega</Button>{error && <p role="alert" className="text-orange-700">{error}</p>}
    </form>;
}
