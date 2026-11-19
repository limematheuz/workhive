"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useWorkerWorkspace } from "./WorkerWorkspace";

// Only open tasks already returned through this worker's authorized workspace.
export function WorkerTaskDeepLink() {
    const search = useSearchParams();
    const { tasks, online, openTask } = useWorkerWorkspace();
    const handled = useRef<string | null>(null);
    const requested = search.get("taskId");
    const task = tasks.find(row => String(row.id) === requested);
    useEffect(() => {
        if (!requested) { handled.current = null; return; }
        if (online && task && handled.current !== requested) {
            handled.current = requested;
            openTask(task);
        }
    }, [requested, task, online, openTask]);
    return requested && !task
        ? <p role="status" className="mb-4 text-sm text-muted-foreground">Este trabajo ya no está disponible en tus trabajos asignados.</p>
        : null;
}
