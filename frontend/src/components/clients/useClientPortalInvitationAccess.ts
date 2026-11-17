"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { CompanyPlanAccessService } from "@/services/company-plan-access.service";

export function useClientPortalInvitationAccess(userId?: number, companyId?: number | null) {
    const context = userId && companyId ? `${userId}:${companyId}` : null;
    const [snapshot, setSnapshot] = useState<{ context: string; enabled: boolean } | null>(null);
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    const invalidate = useCallback(() => { activeContext.current = null; version.current++; }, []);
    const refresh = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const request = ++version.current;
        let enabled = false;
        try {
            const access = await CompanyPlanAccessService.getCurrentEntitlements();
            enabled = access.entitlements.some(item => item.code === "features.client_portal"
                && item.value_type === "boolean" && item.value === true);
        } catch { /* An unknown plan never authorizes a new invitation. */ }
        if (request === version.current && activeContext.current === context) setSnapshot({ context, enabled });
    }, [context]);
    useEffect(() => {
        activeContext.current = context;
        const timer = window.setTimeout(() => void refresh(), 0);
        return () => { window.clearTimeout(timer); invalidate(); };
    }, [context, refresh, invalidate]);
    useBackgroundPolling(refresh, POLL_INTERVALS.realtimeSafety, POLL_INTERVALS.realtimeSafety);
    return Boolean(context && snapshot?.context === context && snapshot.enabled);
}
