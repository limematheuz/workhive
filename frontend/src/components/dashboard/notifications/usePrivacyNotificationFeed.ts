"use client";

import { useCallback } from "react";
import { isCompanyAdminRole } from "@/domain/access/roles";
import { PrivacyService } from "@/services/privacy.service";
import { useNotificationSnapshot } from "./useNotificationSnapshot";

export function usePrivacyNotificationFeed(enabled: boolean, userId: number | undefined,
    companyId: number | undefined, roleName: string | undefined) {
    const context = enabled && userId && companyId && isCompanyAdminRole(roleName) ? `${userId}:${companyId}:${roleName}` : null;
    const read = useCallback((readContext: string) => PrivacyService.listCompanyRequests(`notification-privacy:${readContext}`), []);
    const feed = useNotificationSnapshot(context, read);
    return { privacyRequests: feed.value ?? [], loadPrivacyNotifications: feed.load,
        privacyLoadFailed: feed.failed, privacyLoading: feed.loading };
}
