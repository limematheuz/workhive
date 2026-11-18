"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { writeResourceLog, type Vehicle } from "@/services/resource-log.service";
export function VehicleForm({ vehicle, saved }: {
    vehicle?: Vehicle;
    saved: () => void;
}) {
    const [name, setName] = useState(vehicle?.name ?? "");
    const [registration, setRegistration] = useState(vehicle?.registration ?? "");
    const [km, setKm] = useState(vehicle?.odometer ?? "0");
    const [date, setDate] = useState(vehicle?.service_due_on ?? "");
    const [status, setStatus] = useState(vehicle?.status ?? "active");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    return <form className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3" onSubmit={e => {
            e.preventDefault();
            setBusy(true);
            setError("");
            void writeResourceLog("vehicles" + (vehicle ? "/" + vehicle.id : ""), { name, registration, odometer: km, status, service_due_on: date || null }, vehicle ? "PUT" : "POST")
                .then(saved).catch(e => setError(e.message)).finally(() => setBusy(false));
        }}>
        <label>Vehículo<Input required maxLength={140} value={name} onChange={e => setName(e.target.value)}/></label>
        <label>Matrícula<Input required maxLength={30} value={registration} onChange={e => setRegistration(e.target.value)}/></label>
        <label>Kilometraje<Input required type="number" min="0" step=".1" value={km} onChange={e => setKm(e.target.value)}/></label>
        <label>Próximo mantenimiento<DatePicker value={date} onValueChange={setDate}/></label>
        <label>Estado<FormSelect aria-label={"Estado"}  value={status} onValueChange={selectedOptionValue=>setStatus(selectedOptionValue)}><option value="active">Disponible</option><option value="maintenance">En mantenimiento</option><option value="retired">Retirado</option></FormSelect></label>
        <Button className="self-end" disabled={busy}>{vehicle ? "Guardar vehículo" : "Registrar vehículo"}</Button>
        {error && <p role="alert" className="text-orange-700 sm:col-span-3">{error}</p>}
    </form>;
}
