"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Employee } from "@/services/staff.service";

const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (month: string) => monthFormatter.format(new Date(month + "-01T12:00:00Z"));
export function StaffCostHistory({ worker }: { worker: Employee }) {
    const [all, setAll] = useState(false);
    const entries = Object.entries(worker.history ?? {}).filter(([month]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month)).sort(([first], [second]) => first.localeCompare(second));
    const recent = entries.slice(-6), year = String(new Date().getFullYear());
    const annual = entries.filter(([month]) => month.startsWith(year));
    const peak = Math.max(1, ...recent.map(([, value]) => Number(value.cost)));
    return <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Historial del coste mensual</h3>
        {recent.length < 2 ? recent.length === 1 ? <div className="flex flex-wrap justify-between gap-2 rounded-lg border p-3"><span>{monthLabel(recent[0][0])}</span><strong className="whitespace-nowrap tabular-nums">{formatCurrency(Number(recent[0][1].cost))}</strong></div>
            : <p className="text-muted-foreground">Todavía no hay meses registrados.</p>
            : <figure aria-label="Costes de los últimos meses registrados" className="grid gap-2"><div className="flex h-28 items-end gap-3">{recent.map(([month, value]) => <div key={month} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center" title={`${monthLabel(month)} · ${formatCurrency(Number(value.cost))}`}>
                <div className="rounded-t bg-primary" style={{ height: `${Number(value.cost) / peak * 80}%` }}/><span className="mt-1 text-[11px] text-muted-foreground">{month.slice(5)}</span></div>)}</div><figcaption className="text-xs text-muted-foreground">Importes registrados · {recent.length} meses</figcaption></figure>}
        {annual.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Registrado en {year}</h3><dl className="grid grid-cols-2 gap-3 rounded-lg border p-3"><div><dt className="text-xs text-muted-foreground">Coste de referencia</dt><dd className="mt-1 whitespace-nowrap font-semibold tabular-nums">{formatCurrency(annual.reduce((sum, [, value]) => sum + Number(value.cost), 0))}</dd></div><div><dt className="text-xs text-muted-foreground">Horas contratadas</dt><dd className="mt-1 font-semibold">{annual.reduce((sum, [, value]) => sum + Number(value.hours), 0).toLocaleString("es-ES")} h</dd></div></dl></div>}
        {entries.length > 1 && <><Button size="sm" variant="outline" onClick={() => setAll(value => !value)}>{all ? "Cerrar histórico" : "Ver histórico completo"}</Button>{all && <dl className="divide-y rounded-lg border px-3">{entries.map(([month, value]) => <div key={month} className="flex flex-wrap justify-between gap-2 py-3"><dt>{monthLabel(month)}</dt><dd className="whitespace-nowrap font-medium tabular-nums">{formatCurrency(Number(value.cost))}</dd></div>)}</dl>}</>}
    </section>;
}
