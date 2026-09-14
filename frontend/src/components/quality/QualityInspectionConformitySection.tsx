"use client";

import * as React from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import {
    QualityService,
    type QualityInspection,
} from "@/services/quality.service";

type QualityInspectionConformitySectionProps = {
    inspection: QualityInspection;
    canManage: boolean;
    onSigned: (inspection: QualityInspection) => void;
};

function formatSignedAt(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export function QualityInspectionConformitySection({
    inspection,
    canManage,
    onSigned,
}: QualityInspectionConformitySectionProps) {
    const [acknowledged, setAcknowledged] = React.useState(false);
    const [signing, setSigning] = React.useState(false);
    const [createdConformity, setCreatedConformity] = React.useState<QualityInspection["conformity"]>(null);
    const conformity = createdConformity ?? inspection.conformity;

    const sign = async () => {
        if (!acknowledged || signing) return;
        setSigning(true);
        try {
            const signed = await QualityService.signInspectionConformity(inspection.id);
            setCreatedConformity(signed.conformity);
            onSigned(signed);
            toast.success("Conformidad interna registrada.");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo registrar la conformidad."));
        } finally {
            setSigning(false);
        }
    };

    return (
        <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4">
            <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden="true" />
                <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">Conformidad interna</p>
                    {conformity ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Registrada por {conformity.signer_name} el {formatSignedAt(conformity.signed_at)}.
                        </p>
                    ) : inspection.status !== "completed" ? (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Disponible cuando la inspección esté cerrada.
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                            Confirma internamente que el resultado y las evidencias representan la revisión realizada.
                        </p>
                    )}
                </div>
            </div>
            {!conformity && inspection.status === "completed" && canManage && (
                <>
                    <Label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-3 text-sm font-medium text-[var(--text-main)]">
                        <Checkbox
                            checked={acknowledged}
                            onCheckedChange={(checked) => setAcknowledged(checked === true)}
                            aria-label="Confirmar conformidad interna"
                        />
                        He revisado el resultado y confirmo esta conformidad interna.
                    </Label>
                    <Button type="button" size="sm" className="w-fit" onClick={() => void sign()} disabled={!acknowledged || signing}>
                        {signing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                        Registrar conformidad
                    </Button>
                </>
            )}
            {!conformity && inspection.status === "completed" && !canManage && (
                <p className="text-xs text-[var(--text-muted)]">Necesitas permiso de gestión de calidad para registrarla.</p>
            )}
        </section>
    );
}
