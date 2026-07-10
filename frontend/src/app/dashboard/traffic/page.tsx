"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Shield } from "lucide-react";

import { TrafficAnalyticsPanel } from "@/components/traffic/TrafficAnalyticsPanel";
import { TrafficEventsTable } from "@/components/traffic/TrafficEventsTable";
import { useDictionary } from "@/lib/dictionary-context";
import { authService } from "@/services/auth.service";
import { AuditLogService } from "@/services/audit-log.service";
import { AuditLog } from "@/types/audit-log";
import { User } from "@/types/user";
import { isSuperadmin } from "@/domain/access/roles";
import type { TrafficMapPoint } from "@/lib/traffic-map";
import {
    fallbackTraffic,
    getDeviceLabel,
    getGeoLabel,
    parseCoordinate,
    startOfDayKey,
    TRAFFIC_PAGE_SIZE,
} from "@/lib/traffic/traffic-page-utils";

export default function TrafficPage() {
    const { dict, locale } = useDictionary();
    const traffic = dict.traffic ?? fallbackTraffic[locale];
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [events, setEvents] = useState<AuditLog[]>([]);
    const [activeTab, setActiveTab] = useState<"logins" | "url_only">("logins");
    const [loginPage, setLoginPage] = useState(1);
    const [urlOnlyPage, setUrlOnlyPage] = useState(1);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function loadData() {
            try {
                const me = await authService.getMe();
                if (!mounted) return;
                setCurrentUser(me);
                if (!isSuperadmin(me)) return;
                const auditEvents = await AuditLogService.getAuditLogs(500);
                if (!mounted) return;
                setEvents(auditEvents.filter((event) => event.action === "auth.login" || event.action === "public.page_view"));
            } finally {
                if (mounted) setLoading(false);
            }
        }
        void loadData();
        return () => {
            mounted = false;
        };
    }, []);

    const loginEvents = useMemo(
        () => events.filter((event) => event.action === "auth.login"),
        [events],
    );

    const anonymousUrlEvents = useMemo(() => {
        const loggedVisitorIds = new Set(
            loginEvents.flatMap((event) => {
                const visitorId = event.details.visitor_id;
                return visitorId ? [visitorId] : [];
            }),
        );
        const latestByVisitor = new Map<string, AuditLog>();
        for (const event of events) {
            if (event.action !== "public.page_view") continue;
            const visitorId = event.details.visitor_id;
            if (visitorId && !loggedVisitorIds.has(visitorId) && !latestByVisitor.has(visitorId)) {
                latestByVisitor.set(visitorId, event);
            }
        }
        return Array.from(latestByVisitor.values());
    }, [events, loginEvents]);

    const visibleEvents = activeTab === "logins" ? loginEvents : anonymousUrlEvents;
    const currentPage = activeTab === "logins" ? loginPage : urlOnlyPage;
    const visiblePageCount = Math.max(1, Math.ceil(visibleEvents.length / TRAFFIC_PAGE_SIZE));
    const paginatedEvents = visibleEvents.slice(
        (Math.min(currentPage, visiblePageCount) - 1) * TRAFFIC_PAGE_SIZE,
        Math.min(currentPage, visiblePageCount) * TRAFFIC_PAGE_SIZE,
    );

    const stats = useMemo(() => {
        const dayMs = 24 * 60 * 60 * 1000;
        const referenceTime = events.reduce((latest, event) => {
            const eventTime = new Date(event.created_at).getTime();
            return Number.isFinite(eventTime) ? Math.max(latest, eventTime) : latest;
        }, 0);
        const last24h = events.filter((event) => referenceTime - new Date(event.created_at).getTime() <= dayMs);
        const last7d = events.filter((event) => referenceTime - new Date(event.created_at).getTime() <= 7 * dayMs);
        const uniqueUsers = new Set(
            events.flatMap((event) => {
                const identifier = event.details.user_email || event.actor_user_id || event.details.visitor_id;
                return identifier ? [identifier] : [];
            }),
        );
        const locations = new Set(
            events.flatMap((event) => {
                const label = getGeoLabel(event);
                return label !== "-" ? [label] : [];
            }),
        );
        return {
            total: events.length,
            last24h: last24h.length,
            last7d: last7d.length,
            uniqueUsers: uniqueUsers.size,
            locations: locations.size,
        };
    }, [events]);

    const trend = useMemo(() => {
        const counts = new Map<string, number>();
        const today = new Date();
        for (let index = 6; index >= 0; index -= 1) {
            const date = new Date(today);
            date.setDate(today.getDate() - index);
            counts.set(date.toISOString().slice(0, 10), 0);
        }
        events.forEach((event) => {
            const key = startOfDayKey(event.created_at);
            if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
        });
        const max = Math.max(1, ...counts.values());
        return Array.from(counts.entries()).map(([date, count]) => ({
            date,
            count,
            height: Math.max(8, Math.round((count / max) * 100)),
        }));
    }, [events]);

    const mapPoints = useMemo<TrafficMapPoint[]>(() => {
        return events.flatMap((event) => {
            const lat = parseCoordinate(event.details.geo?.latitude);
            const lng = parseCoordinate(event.details.geo?.longitude);
            if (lat === null || lng === null) return [];
            const location = getGeoLabel(event);
            return [{
                id: event.id.toString(),
                lat,
                lng,
                label: event.details.user_email || event.details.path || traffic.unknown_user,
                location,
            }];
        });
    }, [events, traffic.unknown_user]);

    const platformStats = useMemo(() => {
        const labels = [traffic.desktop, traffic.mobile, traffic.browser];
        const counts = new Map(labels.map((label) => [label, 0]));
        events.forEach((event) => {
            const label = getDeviceLabel(event.details.user_agent, traffic);
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        const total = Math.max(1, events.length);
        return labels.map((label, index) => ({
            label,
            count: counts.get(label) || 0,
            percent: Math.round(((counts.get(label) || 0) / total) * 100),
            color: index === 0 ? "var(--accent-color)" : index === 1 ? "var(--alert-warning-text)" : "var(--text-muted)",
        }));
    }, [events, traffic]);

    const heatmap = useMemo(() => {
        const days = locale === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        const hours = [6, 7, 8, 9, 10, 11, 12, 13];
        const counts = new Map<string, number>();
        events.forEach((event) => {
            const date = new Date(event.created_at);
            const key = `${date.getDay()}-${date.getHours()}`;
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        const max = Math.max(1, ...counts.values());
        return {
            days,
            hours,
            cells: hours.map((hour) =>
                days.map((_, dayIndex) => {
                    const count = counts.get(`${dayIndex}-${hour}`) || 0;
                    return {
                        key: `${dayIndex}-${hour}`,
                        count,
                        opacity: count === 0 ? 0.12 : Math.max(0.25, count / max),
                    };
                }),
            ),
        };
    }, [events, locale]);

    const handleTabChange = (tab: "logins" | "url_only") => {
        setActiveTab(tab);
        if (tab === "logins") setLoginPage(1);
        else setUrlOnlyPage(1);
    };

    const handlePageChange = (page: number) => {
        if (activeTab === "logins") setLoginPage(page);
        else setUrlOnlyPage(page);
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
                <span className="text-sm text-[var(--text-muted)]">{traffic.loading}</span>
            </div>
        );
    }

    if (!isSuperadmin(currentUser)) {
        return (
            <div className="p-8">
                <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center">
                    <Shield className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
                    <h1 className="mt-3 text-xl font-black text-[var(--text-main)]">{traffic.restricted_title}</h1>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{traffic.restricted_desc}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto px-2 py-2 sm:px-3 lg:px-4">
            <div className="mx-auto max-w-none space-y-3">
                <TrafficAnalyticsPanel
                    traffic={traffic}
                    locale={locale}
                    stats={stats}
                    loginEventCount={loginEvents.length}
                    anonymousUrlEventCount={anonymousUrlEvents.length}
                    latestEvent={events[0]}
                    mapPoints={mapPoints}
                    trend={trend}
                    platformStats={platformStats}
                    heatmap={heatmap}
                />

                <TrafficEventsTable
                    traffic={traffic}
                    locale={locale}
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    loginEventCount={loginEvents.length}
                    anonymousUrlEventCount={anonymousUrlEvents.length}
                    paginatedEvents={paginatedEvents}
                    visibleEventCount={visibleEvents.length}
                    currentPage={currentPage}
                    visiblePageCount={visiblePageCount}
                    onPageChange={handlePageChange}
                />
            </div>
        </div>
    );
}
