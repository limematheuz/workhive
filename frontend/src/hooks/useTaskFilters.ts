"use client";

import {useTaskQueryState} from "@/hooks/useTaskQueryState";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseTaskPageTab, type TaskPageTab } from "@/domain/tasks/task-list";

export function useTaskFilters() {
    const searchParams = useSearchParams();
    const tabFromUrl = parseTaskPageTab(searchParams.get("tab"));
    const [selectedStatus, setSelectedStatus] = useTaskQueryState("status","");
    const [selectedLocationId, setSelectedLocationId] = useTaskQueryState("location","");
    const [selectedUserId, setSelectedUserId] = useTaskQueryState("worker","");
    const [activeTab, writeActiveTab] = useState<TaskPageTab>(() => tabFromUrl ?? "kanban");
    const [urlTabSnapshot, setUrlTabSnapshot] = useState(tabFromUrl);

    // Sync from the URL when the query param changes (render-time adjust, no effect).
    if (tabFromUrl !== urlTabSnapshot) {
        setUrlTabSnapshot(tabFromUrl);
        if (tabFromUrl) {
            writeActiveTab(tabFromUrl);
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
        setActiveTab: (tab:TaskPageTab) => { writeActiveTab(tab); const target=new URL(window.location.href);target.searchParams.set("tab",tab);window.history.replaceState(null,"",target.pathname+target.search+target.hash); },
    };
}
