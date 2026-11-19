"use client";
import {useState} from "react";
import {Checkbox} from "@/components/ui/checkbox";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {saveAdvisoryGrant} from "@/services/advisory.service";

export function AdvisoryGrantSettings() {
    const [email,setEmail] = useState("");
    const [accounting,setAccounting] = useState(true);
    const [payroll,setPayroll] = useState(false);
    const [closing,setClosing] = useState(false);
    const [message,setMessage] = useState("");
    const [busy,setBusy] = useState(false);
    async function save() {
        setBusy(true); setMessage("");
        try { await saveAdvisoryGrant({email,accounting,payroll,can_close_periods:accounting&&closing}); setMessage("Permisos de gestoría guardados."); }
        catch(e) { setMessage(e instanceof Error ? e.message : "No se pudo guardar."); }
        finally { setBusy(false); }
    }
    return <form className="flex flex-wrap items-end gap-3 rounded-xl border p-4" onSubmit={e => {e.preventDefault(); void save();}}>
        <label>Correo de la gestoría<Input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="flex items-center gap-2"><Checkbox checked={accounting} onCheckedChange={value => setAccounting(value === true)} />Contable y fiscal</label>
        <label className="flex items-center gap-2"><Checkbox checked={payroll} onCheckedChange={value => setPayroll(value === true)} />Laboral</label>
        <label className="flex items-center gap-2"><Checkbox disabled={!accounting} checked={accounting&&closing} onCheckedChange={value=>setClosing(value === true)}/>Autorizar cierre de periodos contables</label>
        <Button disabled={busy}>Guardar acceso</Button><p role="status" className="w-full text-sm">{message}</p>
    </form>;
}
