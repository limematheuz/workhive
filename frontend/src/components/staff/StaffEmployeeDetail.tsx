"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { FormSelect } from "@/components/ui/form-select";
import { RecordHistoryPanel } from "@/components/history/RecordHistoryPanel";
import { formatCurrency } from "@/lib/format";
import { monthlyBreakdown } from "@/domain/staff/staff-costs";
import { costLabels, hourly, monthly, type CostKey, type Employee } from "@/services/staff.service";
import { StaffAvailabilitySummary } from "./StaffAvailabilitySummary";
import { StaffCostHistory } from "./StaffCostHistory";

export type StaffDetailTab = "Información" | "Costes" | "Disponibilidad" | "Documentos";
const tabs: Array<{ id: StaffDetailTab; label: string }> = ["Información", "Costes", "Disponibilidad", "Documentos"].map(value => ({ id: value as StaffDetailTab, label: value }));
export function StaffEmployeeDetail({ worker, tab, setTab, close, edit, filterTeam, compactTabs }: {
    worker: Employee; tab: StaffDetailTab; setTab: (tab: StaffDetailTab) => void; close: () => void; edit?: () => void; filterTeam: () => void; compactTabs: boolean;
}) {
    return <div className="space-y-4 p-4 text-sm sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold leading-6">{worker.name}</h2><p className="mt-1 break-words text-xs text-muted-foreground">{worker.position} · {worker.profile.state}</p></div><Button size="icon" variant="ghost" aria-label="Cerrar ficha" onClick={close}><X className="size-4"/></Button></div>
        {compactTabs ? <FormSelect aria-label="Sección de la ficha del trabajador" value={tab} onValueChange={value => setTab(value as StaffDetailTab)}>{tabs.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</FormSelect>
            : <PremiumTabs tabs={tabs} activeTab={tab} onChange={setTab} mobileLabel="Sección de la ficha del trabajador"/>}
        {tab === "Costes" && <><section className="space-y-3"><h3 className="font-semibold">Desglose mensual de referencia</h3>{monthlyBreakdown(worker) === 0 && hourly(worker) > 0 && <p className="text-xs text-orange-700">Desglose pendiente. La referencia usa el coste por hora registrado y las horas contratadas.</p>}
            <dl className="space-y-3">{Object.entries(costLabels).map(([key, label]) => <div key={key} className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">{formatCurrency(Number(worker.profile[key as CostKey]))}</dd></div>)}
                <div className="flex flex-wrap justify-between gap-2 border-t pt-3"><dt>Coste mensual de referencia</dt><dd className="whitespace-nowrap font-semibold tabular-nums text-primary">{formatCurrency(monthly(worker))}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Coste por hora</dt><dd className="whitespace-nowrap tabular-nums">{formatCurrency(hourly(worker))}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Horas contratadas / mes</dt><dd>{Number(worker.monthly_hours).toLocaleString("es-ES")} h</dd></div></dl></section><StaffCostHistory worker={worker}/></>}
        {tab === "Información" && <dl className="space-y-4"><div><dt className="text-xs text-muted-foreground">Cargo</dt><dd className="mt-1">{worker.position || "Pendiente"}</dd></div><div><dt className="text-xs text-muted-foreground">Equipo</dt><dd><Button size="sm" variant="link" className="h-auto px-0 py-1 text-left" onClick={filterTeam}>{worker.team || "Sin equipo"}</Button></dd></div><div><dt className="text-xs text-muted-foreground">Contrato</dt><dd className="mt-1">{worker.profile.contract || "Pendiente"}</dd></div><div><dt className="text-xs text-muted-foreground">Estado</dt><dd className="mt-1">{worker.profile.state}</dd></div></dl>}
        {tab === "Disponibilidad" && <StaffAvailabilitySummary worker={worker}/>}
        {tab === "Documentos" && (worker.profile.documents.length ? <ul className="divide-y rounded-lg border px-3">{worker.profile.documents.map(document => <li key={document.url} className="py-3"><a className="break-words font-medium text-primary underline underline-offset-2" href={document.url} target="_blank" rel="noreferrer">{document.name} ↗</a></li>)}</ul> : <p className="text-muted-foreground">Sin documentos vinculados.</p>)}
        {edit && <Button size="sm" variant="outline" className="w-full" onClick={edit}>Editar ficha</Button>}
        <RecordHistoryPanel entityType="staff_employee" entityId={worker.id}/>
    </div>;
}
