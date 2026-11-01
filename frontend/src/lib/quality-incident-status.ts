import type { QualityIncident } from "@/services/quality.service";

export const incidentStatusLabel: Record<QualityIncident["status"], string> = {
    open: "Abierta", in_progress: "En curso", resolved: "Resuelta", closed: "Cerrada",
};
