"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type TaskPageTab = "kanban" | "list" | "calendar" | "templates" | "requests";

const VALID_TABS = new Set<TaskPageTab>([
    "requests",
    "kanban",
    "list",
    "calendar",
    "templates",
]);

function parseTabParam(value: string | null): TaskPageTab | null {
    if (value && VALID_TABS.has(value as TaskPageTab)) {
        return value as TaskPageTab;
    }
    return null;
}

export function useTaskFilters() {
    const searchParams = useSearchParams();
    const tabFromUrl = parseTabParam(searchParams.get("tab"));
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [selectedLocationId, setSelectedLocationId] = useState<string>("");
    const [selectedUserId, setSelectedUserId] = useState<string>("");
    const [activeTab, setActiveTab] = useState<TaskPageTab>(() => tabFromUrl ?? "kanban");
    const [urlTabSnapshot, setUrlTabSnapshot] = useState(tabFromUrl);

    // Sync from the URL when the query param changes (render-time adjust, no effect).
    if (tabFromUrl !== urlTabSnapshot) {
        setUrlTabSnapshot(tabFromUrl);
        if (tabFromUrl) {
            setActiveTab(tabFromUrl);
        }
    }

    return {
        selectedStatus,
        setSelectedStatus,
        selectedLocationId,
        setSelectedLocationId,
        selectedUserId,
        setSelectedUserId,
        activeTab,
        setActiveTab,
    };
}
