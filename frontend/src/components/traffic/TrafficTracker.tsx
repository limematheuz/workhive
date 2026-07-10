"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { getVisitorId } from "@/lib/visitor-id";
import { TrafficService } from "@/services/traffic.service";

export function TrafficTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (pathname.startsWith("/dashboard")) return;

        const visitorId = getVisitorId();
        if (!visitorId) return;

        const query = window.location.search.replace(/^\?/, "");
        const path = query ? `${pathname}?${query}` : pathname;
        const sessionKey = `workhive_tracked:${path}`;
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, "1");

        void TrafficService.recordPageView({
            visitor_id: visitorId,
            path,
            referrer: document.referrer || null,
            title: document.title || null,
            screen: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
            language: navigator.language || null,
        });
    }, [pathname]);

    return null;
}
