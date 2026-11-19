"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/ui/form-select";
import { Button } from "@/components/ui/button";
import { advisoryRequests, type AdvisoryRequest } from "@/services/advisory-delivery.service";
function Reply({ company, row, done }: {
    company: number;
    row: AdvisoryRequest;
    done: (row: AdvisoryRequest) => void;
}) {
    const [text, setText] = useState(row.response ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        try {
            done(await advisoryRequests(company, { response: text }, row.id) as AdvisoryRequest);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo responder.");
        } finally {
            setBusy(false);
        }
    }
    return <form className="mt-2 space-y-2" onSubmit={event => void handleReplySubmit(event)}><Textarea disabled={busy} required maxLength={4000} aria-label="Respuesta a la gestoría" value={text} onChange={e => setText(e.target.value)}/><Button size="sm" disabled={busy}>Enviar respuesta</Button>{error && <p role="alert">{error}</p>}</form>;
}
export function AdvisoryRequests({ company, external, accounting, payroll, canReply }: {
    company: number;
    external: boolean;
    accounting: boolean;
    payroll: boolean;
    canReply: boolean;
}) {
    const [rows, setRows] = useState<AdvisoryRequest[]>([]), [description, setDescription] = useState(""), [area, setArea] = useState(accounting ? "accounting" : "payroll"), [busy, setBusy] = useState(false), [error, setError] = useState("");
    useEffect(() => { let active = true; advisoryRequests(company).then(data => { if (active)
        setRows(data as AdvisoryRequest[]); }).catch(e => { if (active)
        setError(e.message); }); return () => { active = false; }; }, [company]);
    async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        try {
            const item = await advisoryRequests(company, { area, description }) as AdvisoryRequest;
            setRows(current => [item, ...current]);
            setDescription("");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo solicitar.");
        } finally {
            setBusy(false);
        }
    }
    return <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Peticiones de información</h2>{error && <p role="alert" className="text-orange-700">{error}</p>}
 {external && <form className="space-y-2" onSubmit={event => void handleRequestSubmit(event)}><fieldset disabled={busy} className="space-y-2"><label className="text-sm">Área<FormSelect aria-label="Área de la petición" className="staff-select" value={area} onValueChange={setArea}>{accounting && <option value="accounting">Contabilidad</option>}{payroll && <option value="payroll">Laboral</option>}</FormSelect></label><Textarea required maxLength={2000} aria-label="Información pendiente" value={description} onChange={e => setDescription(e.target.value)} placeholder="Qué información necesitas de la empresa"/><Button size="sm">Solicitar información</Button></fieldset></form>}
 {rows.map(row => <article key={row.id} className="border-t pt-3"><p className="text-sm font-medium">{row.area === "payroll" ? "Laboral" : "Contabilidad"} · {row.description}</p><p className={row.response ? "mt-1 whitespace-pre-wrap text-sm" : "mt-1 text-sm text-orange-700"}>{row.response ?? "Pendiente de respuesta de la empresa"}</p>{!external && canReply && !row.response && <Reply company={company} row={row} done={updated => setRows(current => current.map(r => r.id === updated.id ? updated : r))}/>}</article>)}</section>;
}
