"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCompanyAdminRole } from "@/domain/access/roles";
import { PrivacyService, type PrivacyRequest } from "@/services/privacy.service";

export function usePrivacyNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, roleName: string | undefined) {
    const context = enabled && userId && companyId && isCompanyAdminRole(roleName) ? `${userId}:${companyId}:${roleName}` : null;
    const [snapshot, setSnapshot] = useState<{ context: string; items: PrivacyRequest[] } | null>(null);
    const activeContext = useRef<string | null>(null);
    const version = useRef(0);
    const invalidateRequests = useCallback(() => { activeContext.current = null; version.current++; }, []);
    useEffect(() => {
        activeContext.current = context;
        return invalidateRequests;
    }, [context, invalidateRequests]);

    const loadPrivacyNotifications = useCallback(async () => {
        if (!context || activeContext.current !== context) return;
        const request = ++version.current;
        const items = await PrivacyService.listCompanyRequests(`notification-privacy:${context}:${request}`).catch(() => [] as PrivacyRequest[]);
        if (request === version.current && activeContext.current === context) setSnapshot({ context, items });
    }, [context]);

    return { privacyRequests: context && snapshot?.context === context ? snapshot.items : [], loadPrivacyNotifications };
}
