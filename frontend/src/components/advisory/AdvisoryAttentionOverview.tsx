"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { advisoryRequests, type AdvisoryRequest } from "@/services/advisory-delivery.service";
import { advisoryRequestStep } from "@/lib/portal-attention";

export function AdvisoryAttentionOverview({ company, external, canReply, onOpen }: { company: number; external: boolean; canReply: boolean; onOpen: (filter: "pending" | "answered") => void }) {
    const [rows, setRows] = useState<AdvisoryRequest[] | null>(null), [error, setError] = useState(false), [revision, setRevision] = useState(0);
    const request = useCallback(() => advisoryRequests(company), [company]);
    useResourceEffect(true, `${company}:${revision}`, request, (data) => { setRows(data as AdvisoryRequest[]); setError(false); }, () => { setRows(null); setError(true); });
    if (error) return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-400/30 p-3 text-sm"><p>No se pudieron consultar las peticiones de información.</p><Button size="sm" variant="outline" onClick={() => { setError(false); setRevision((value) => value + 1); }}>Reintentar</Button></div>;
    if (rows === null) return <p role="status" className="text-sm text-muted-foreground">Consultando información pendiente de esta empresa…</p>;
    const pending = rows.filter((row) => advisoryRequestStep(row) === "company").sort((first,second)=>first.created_at.localeCompare(second.created_at));
    const answered = rows.filter((row) => advisoryRequestStep(row) === "response_available");
    return <section className="space-y-3"><SummaryMetricGrid desktopColumns={3} className="lg:grid-cols-2"><FinanceMetricButton label="Información pendiente" value={String(pending.length)} description={external ? "La empresa tiene el siguiente paso" : "Tu empresa debe responder a la gestoría"} icon={MessageSquare} attention={pending.length > 0} onClick={() => onOpen("pending")} /><FinanceMetricButton label="Respuestas disponibles" value={String(answered.length)} description="Información entregada · consultar respuestas" icon={CheckCircle2} onClick={() => onOpen("answered")} /></SummaryMetricGrid>{pending.slice(0, 3).map((row) => <div key={row.id} className="billing-surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{row.description}</p><p className="mt-1 text-xs text-muted-foreground">{row.area === "accounting" ? "Contabilidad" : "Laboral"} · Siguiente paso: {external ? "empresa" : "tu empresa"}</p></div><Button size="sm" variant="outline" onClick={() => onOpen("pending")}>{!external && canReply ? "Responder" : "Ver petición"}</Button></div>)}</section>;
}
