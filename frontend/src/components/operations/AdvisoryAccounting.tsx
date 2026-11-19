"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { accountingRecords, type AccountingRecords } from "@/services/advisory-accounting.service";
export function AdvisoryAccounting({ company, month }: {
    company: number;
    month: string;
}) {
    const [data, setData] = useState<AccountingRecords | null>(null), [offset, setOffset] = useState(0), [error, setError] = useState("");
    useEffect(() => { let active = true; accountingRecords(company, month, offset).then(value => { if (active) {
        setData(value);
        setError("");
    } }).catch(e => { if (active)
        setError(e.message); }); return () => { active = false; }; }, [company, month, offset]);
    return <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Facturas, gastos y justificantes del mes</h2>{error && <p role="alert" className="text-orange-700">{error}</p>}{data && <><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2"><h3 className="text-sm font-semibold">Facturas emitidas</h3>{data.invoices.map(i => <div key={i.id} className="flex justify-between gap-2 border-t pt-2 text-sm"><span>{i.number} · {i.status} · {i.total} €</span><a className="underline" href={i.pdf} download>Descargar PDF</a></div>)}{!data.invoices.length && <p className="text-sm text-muted-foreground">Sin facturas en esta página.</p>}</div><div className="space-y-2"><h3 className="text-sm font-semibold">Gastos registrados</h3>{data.expenses.map(e => <div key={e.id} className="flex justify-between gap-2 border-t pt-2 text-sm"><span>{e.vendor} · {e.description} · {e.total} €</span>{e.receipt ? <a className="underline" href={e.receipt} download>Justificante</a> : <span className="text-orange-700">Sin justificante</span>}</div>)}{!data.expenses.length && <p className="text-sm text-muted-foreground">Sin gastos en esta página.</p>}</div></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!offset} onClick={() => setOffset(v => Math.max(0, v - 100))}>Anterior</Button><Button size="sm" variant="outline" disabled={!data.has_more} onClick={() => setOffset(v => v + 100)}>Siguientes 100</Button></div></>}</section>;
}
