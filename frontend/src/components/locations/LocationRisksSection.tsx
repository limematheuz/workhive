import { Plus, ShieldAlert, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
    LocationRisk,
    LocationRiskSeverity,
    LocationRiskStatus,
} from "@/types/location";

const RISK_SEVERITY_LABELS: Record<LocationRiskSeverity, string> = {
    low: "Bajo",
    medium: "Medio",
    high: "Alto",
    critical: "Crítico",
};

const RISK_STATUS_LABELS: Record<LocationRiskStatus, string> = {
    open: "Pendiente",
    mitigated: "Mitigado",
};

const EMPTY_RISK: LocationRisk = {
    title: "",
    description: "",
    severity: "medium",
    status: "open",
    mitigation_notes: "",
};

interface LocationRisksSectionProps {
    risks: LocationRisk[];
    setRisks: (value: LocationRisk[]) => void;
}

export function LocationRisksSection({ risks, setRisks }: LocationRisksSectionProps) {
    const updateRisk = (index: number, changes: Partial<LocationRisk>) => {
        setRisks(risks.map((risk, riskIndex) => (
            riskIndex === index ? { ...risk, ...changes } : risk
        )));
    };

    return (
        <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                        <ShieldAlert className="h-4 w-4 text-accent" />
                        Riesgos operativos
                    </div>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        Registra condiciones que el equipo debe conocer antes de trabajar. Una vez mitigado, se conserva como antecedente.
                    </p>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setRisks([...risks, { ...EMPTY_RISK, draft_id: crypto.randomUUID() }])}
                >
                    <Plus className="h-4 w-4" /> Añadir riesgo
                </Button>
            </div>

            {risks.length === 0 ? (
                <p className="mt-4 rounded-xl bg-[var(--bg-secondary)] px-3 py-3 text-sm text-[var(--text-muted)]">
                    No hay riesgos operativos registrados para esta ubicación.
                </p>
            ) : (
                <div className="mt-4 space-y-3">
                    {risks.map((risk, index) => (
                        <div key={risk.id ?? risk.draft_id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 sm:p-4">
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-1.5 xl:col-span-2">
                                    <Label htmlFor={`location-risk-title-${index}`}>Riesgo</Label>
                                    <Input
                                        id={`location-risk-title-${index}`}
                                        value={risk.title}
                                        onChange={(event) => updateRisk(index, { title: event.target.value })}
                                        placeholder="Ej.: Suelo resbaladizo junto a la entrada"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`location-risk-severity-${index}`}>Nivel</Label>
                                    <Select value={risk.severity} onValueChange={(value) => updateRisk(index, { severity: value as LocationRiskSeverity })}>
                                        <SelectTrigger id={`location-risk-severity-${index}`}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(RISK_SEVERITY_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`location-risk-status-${index}`}>Estado</Label>
                                    <Select value={risk.status} onValueChange={(value) => updateRisk(index, { status: value as LocationRiskStatus })}>
                                        <SelectTrigger id={`location-risk-status-${index}`}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(RISK_STATUS_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>{label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor={`location-risk-description-${index}`}>Qué debe saber el equipo</Label>
                                    <Textarea
                                        id={`location-risk-description-${index}`}
                                        value={risk.description || ""}
                                        onChange={(event) => updateRisk(index, { description: event.target.value })}
                                        className="min-h-20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor={`location-risk-mitigation-${index}`}>Medida preventiva o corrección</Label>
                                    <Textarea
                                        id={`location-risk-mitigation-${index}`}
                                        value={risk.mitigation_notes || ""}
                                        onChange={(event) => updateRisk(index, { mitigation_notes: event.target.value })}
                                        className="min-h-20"
                                    />
                                </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-[var(--text-muted)] hover:text-destructive"
                                    onClick={() => setRisks(risks.filter((_, riskIndex) => riskIndex !== index))}
                                >
                                    <Trash2 className="h-4 w-4" /> Eliminar
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
