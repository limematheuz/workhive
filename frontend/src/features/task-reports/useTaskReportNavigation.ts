"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TaskReport } from "@/services/task-report.service";

/** Resolve links only against the current account's authorized history. */
export function useTaskReportNavigation(reports: TaskReport[], ready: boolean) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const urlKey = params.toString();
    const rawId = params.get("reportId");
    const linkedId = rawId && /^[1-9]\d*$/.test(rawId) && Number.isSafeInteger(Number(rawId))
        ? Number(rawId) : null;
    const [manual, setManual] = useState<{ urlKey: string; id: number | null } | null>(null);
    const id = manual?.urlKey === urlKey ? manual.id : linkedId;
    const selectedReport = reports.find(report => report.id === id) ?? null;
    function setSelectedReport(report: TaskReport | null) {
        setManual({ urlKey, id: report?.id ?? null });
        if (!report && rawId !== null) {
            const next = new URLSearchParams(urlKey);
            next.delete("reportId");
            router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
        }
    }
    return {
        selectedReport,
        setSelectedReport,
        linkUnavailable: ready && rawId !== null && manual?.urlKey !== urlKey && !selectedReport,
    };
}
