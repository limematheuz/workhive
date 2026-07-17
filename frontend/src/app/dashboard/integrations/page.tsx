"use client";

import { useCallback, useEffect, useState } from "react";
import { redirect } from "next/navigation";
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
    const [saving, setSaving] = useState(false);

    const loadStatus = useCallback(async () => {
        setLoading(true);
        try {
            setStatus(await CalendarService.getPlatformStatus());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : labels.load_error);
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

    if (!status || !isPlatformSuperadmin(user)) return null;

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
        <PlatformCalendarOverview
            status={status}
            labels={labels}
            saving={saving}
            onToggle={(enabled) => { void updateAvailability(enabled); }}
            onRefresh={() => { void loadStatus(); }}
            onCopyCallback={() => { void copyCallback(); }}
        />
    );
}
