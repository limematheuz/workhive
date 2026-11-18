"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deliverPayroll } from "@/services/advisory-delivery.service";
export function PayrollDelivery({ company, employee, month, delivered }: {
    company: number;
    employee: number;
    month: string;
    delivered: () => void;
}) {
    const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    return <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (!file)
        return; setBusy(true); setMessage(""); try {
        await deliverPayroll(company, employee, month, file);
        setMessage("Nómina entregada. Disponible en la documentación del trabajador.");
        delivered();
    }
    catch (e) {
        setMessage(e instanceof Error ? e.message : "No se pudo entregar.");
    }
    finally {
        setBusy(false);
    } }}><label className="text-xs">Nómina de {month}<Input disabled={busy} required type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label><Button size="sm" variant="outline" disabled={busy || !file}>Entregar nómina</Button>{message && <p role="status" className="text-xs">{message}</p>}</form>;
}
