"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { CloudCog, Loader2 } from "lucide-react";

import { PlatformCalendarOverview } from "@/components/integrations/PlatformCalendarOverview";
import { PageHeader } from "@/components/ui/page-header";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    shouldShowReadRetry,
    type ReadErrorKind,
} from "@/lib/read-recovery";
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
    const workspaceKey = getReadWorkspaceKey(user);
    const [status, setStatus] = useState<PlatformCalendarStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [readErrorKind, setReadErrorKind] = useState<ReadErrorKind | null>(null);
    const requestIdRef = useRef(0);
    const loadedWorkspaceRef = useRef<string | null>(null);

    const loadStatus = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        if (loadedWorkspaceRef.current !== workspaceKey) {
            setStatus(null);
            setLoading(true);
        }
        try {
            const nextStatus = await CalendarService.getPlatformStatus();
            if (requestIdRef.current !== requestId) return;
            loadedWorkspaceRef.current = workspaceKey;
            setStatus(nextStatus);
            setReadErrorKind(null);
        } catch (error) {
            if (requestIdRef.current !== requestId) return;
            const kind = classifyReadError(error);
            setReadErrorKind(kind);
            if (kind === "denied" || loadedWorkspaceRef.current !== workspaceKey) {
                loadedWorkspaceRef.current = null;
                setStatus(null);
            } else {
                toast.error(error instanceof Error ? error.message : labels.load_error);
            }
        } finally {
            setLoading((current) => (requestIdRef.current === requestId ? false : current));
        }
    }, [labels.load_error, workspaceKey]);

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

    const recoveryMessage = getReadRecoveryMessage(readErrorKind, {
        unavailable: labels.load_error,
        denied: dict.dashboard.access_denied,
    });

    if (!status) {
        return (
            <div className="mx-auto max-w-6xl space-y-4 px-[3%] py-6 text-[var(--text-main)] md:p-8">
                <PageHeader
                    icon={CloudCog}
                    title={labels.title}
                    subtitle={labels.subtitle}
                    titleAs="h2"
                    className="mb-0"
                />
                {recoveryMessage && (
                    <div data-integrations-read-error="">
                        <ReadRecoveryBanner
                            kind={readErrorKind ?? "unavailable"}
                            message={recoveryMessage}
                            retryLabel={dict.dashboard.retry_load_data}
                            onRetry={shouldShowReadRetry(readErrorKind) ? () => { void loadStatus(); } : undefined}
                        />
                    </div>
                )}
            </div>
        );
    }

    const updateAvailability = async (enabled: boolean) => {
        setSaving(true);
        try {
            setStatus(await CalendarService.updatePlatformStatus(enabled));
            setReadErrorKind(null);
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
        <>
            {recoveryMessage && (
                <div className="mx-auto max-w-6xl px-[3%] pt-6 md:px-8 md:pt-8" data-integrations-read-error="">
                    <ReadRecoveryBanner
                        kind={readErrorKind ?? "unavailable"}
                        message={recoveryMessage}
                        retryLabel={dict.dashboard.retry_load_data}
                        onRetry={shouldShowReadRetry(readErrorKind) ? () => { void loadStatus(); } : undefined}
                    />
                </div>
            )}
            <PlatformCalendarOverview
                status={status}
                labels={labels}
                saving={saving}
                onToggle={(enabled) => { void updateAvailability(enabled); }}
                onRefresh={() => { void loadStatus(); }}
                onCopyCallback={() => { void copyCallback(); }}
            />
        </>
    );
}
