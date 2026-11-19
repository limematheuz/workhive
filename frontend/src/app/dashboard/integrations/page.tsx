"use client";

import { useCallback, useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

import { PlatformCalendarOverview } from "@/components/integrations/PlatformCalendarOverview";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import {
    CalendarService,
    type PlatformCalendarStatus,
} from "@/services/calendar.service";

export default function PlatformIntegrationsPage() {
    const { dict } = useDictionary();
    const labels = dict.platform_calendar;
    const { user, loading: userLoading } = useUser();
    const [status, setStatus] = useState<PlatformCalendarStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error,setError]=useState("");
    const [saving, setSaving] = useState(false);

    const loadStatus = useCallback(async (showLoader=true) => {
        if(showLoader)setLoading(true);
        try {
            setStatus(await CalendarService.getPlatformStatus());
            setError("");
        } catch (error) {
            setError(error instanceof Error ? error.message : labels.load_error);
        } finally {
            setLoading(false);
        }
    }, [labels.load_error]);

    useEffect(() => {
        if (userLoading || !isPlatformSuperadmin(user)) return;
        const timer = window.setTimeout(() => {
            void loadStatus();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [loadStatus, user, userLoading]);

    if (!userLoading && !isPlatformSuperadmin(user)) {
        redirect("/dashboard");
    }

    if (userLoading || loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    if (!isPlatformSuperadmin(user)) return null;
    if(!status)return <main className="dashboard-page-content p-6"><h1 className="text-2xl font-semibold">Integraciones de la plataforma</h1><div role="alert" className="mt-4 space-y-3 rounded-xl border border-orange-400/40 p-4"><p>{error||"El estado de las integraciones no está disponible."}</p><Button variant="outline" onClick={()=>void loadStatus()}>Reintentar</Button></div></main>;

    const updateAvailability = async (enabled: boolean) => {
        setSaving(true);
        try {
            setStatus(await CalendarService.updatePlatformStatus(enabled));
            toast.success(labels.update_success);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : labels.update_error);
        } finally {
            setSaving(false);
        }
    };

    const copyCallback = async () => {
        try {
            await navigator.clipboard.writeText(status.redirect_uri);
            toast.success(labels.callback_copied);
        } catch {
            toast.error(labels.callback_copy_error);
        }
    };

    return (
        <>{error&&<div role="alert" className="mx-6 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-orange-400/40 p-4"><p className="flex-1">{error} Se conserva el último estado consultado.</p><Button variant="outline" size="sm" onClick={()=>void loadStatus(false)}>Reintentar</Button></div>}<PlatformCalendarOverview
            status={status}
            labels={labels}
            saving={saving}
            onToggle={(enabled) => { void updateAvailability(enabled); }}
            onRefresh={() => { void loadStatus(false); }}
            onCopyCallback={() => { void copyCallback(); }}
        /><p className="mx-6 mb-6 text-xs text-muted-foreground">Este panel muestra configuración global. La respuesta disponible no incluye historial de sincronizaciones por empresa.</p></>
    );
}
