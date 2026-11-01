"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage } from "@/lib/errors";
import { getQualityWorkspaceAccess } from "@/lib/quality-workspace-access";
import { LocationService, type Location } from "@/services/location.service";
import { OrganizationService } from "@/services/organization.service";
import { QualityService, type QualityComplaint, type QualityIncident, type QualityInspection, type QualityTemplate } from "@/services/quality.service";

const emptyAccess = getQualityWorkspaceAccess({});
type LoadState = {
    phase: "loading" | "ready" | "failed";
    access: ReturnType<typeof getQualityWorkspaceAccess>;
    error: string | null;
};

export function useQualityWorkspaceData(enabled: boolean) {
    const [loadState, setLoadState] = useState<LoadState>({ phase: "loading", access: emptyAccess, error: null });
    const [templates, setTemplates] = useState<QualityTemplate[]>([]);
    const [inspections, setInspections] = useState<QualityInspection[]>([]);
    const [incidents, setIncidents] = useState<QualityIncident[]>([]);
    const [complaints, setComplaints] = useState<QualityComplaint[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const requestVersion = useRef(0);
    const invalidatePendingRequest = useCallback(() => { requestVersion.current++; }, []);

    const reload = useCallback(async () => {
        if (!enabled) return;
        const version = ++requestVersion.current;
        setLoadState({ phase: "loading", access: emptyAccess, error: null });
        setTemplates([]); setInspections([]); setIncidents([]); setComplaints([]); setLocations([]);
        try {
            const nextAccess = getQualityWorkspaceAccess(await OrganizationService.getAccess());
            if (version !== requestVersion.current) return;
            const [nextTemplates, nextInspections, nextIncidents, nextComplaints, nextLocations] = await Promise.all([
                nextAccess.read.templates ? QualityService.getTemplates() : [],
                nextAccess.read.inspections ? QualityService.getInspections() : [],
                nextAccess.read.incidents ? QualityService.getIncidents() : [],
                nextAccess.read.complaints ? QualityService.getComplaints() : [],
                nextAccess.readLocations ? LocationService.getLocations() : [],
            ]);
            if (version !== requestVersion.current) return;
            setTemplates(nextTemplates); setInspections(nextInspections); setIncidents(nextIncidents);
            setComplaints(nextComplaints); setLocations(nextLocations);
            setLoadState({ phase: "ready", access: nextAccess, error: null });
        } catch (cause) {
            if (version === requestVersion.current) setLoadState({ phase: "failed", access: emptyAccess,
                error: getErrorMessage(cause, "No se pudo cargar el espacio de Calidad.") });
        }
    }, [enabled]);

    useEffect(() => {
        const timer = window.setTimeout(() => void reload(), 0);
        return () => { window.clearTimeout(timer); invalidatePendingRequest(); };
    }, [reload, invalidatePendingRequest]);

    return { access: loadState.access, loading: loadState.phase === "loading", error: loadState.error,
        reload, templates, setTemplates, inspections, setInspections,
        incidents, setIncidents, complaints, setComplaints, locations };
}
