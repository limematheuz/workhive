"use client";

import { Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TechTaskWorkMode =
    | "finish"
    | "blocked-other-session"
    | "start"
    | "completed"
    | "not-assigned"
    | "accept-first";

interface TechTaskWorkControlsProps {
    mode: TechTaskWorkMode;
    updatingStatus: boolean;
    dict: {
        tech: {
            btn_finish_work: string;
            shift_finish_other_first: string;
            btn_start_work: string;
            msg_completed: string;
            msg_not_assigned: string;
            msg_accept_first: string;
        };
    };
    onStartWork: () => void;
    onFinishWork: () => void;
}

const primaryCtaClass =
    "h-11 w-full rounded-xl border-accent bg-accent text-sm font-semibold uppercase tracking-wider text-white shadow-md shadow-accent/20 hover:bg-accent-light";

export function TechTaskWorkControls({
    mode,
    updatingStatus,
    dict,
    onStartWork,
    onFinishWork,
}: TechTaskWorkControlsProps) {
    if (mode === "finish") {
        return (
            <Button
                disabled={updatingStatus}
                onClick={onFinishWork}
                className={primaryCtaClass}
            >
                <CheckCircle2 className="h-4 w-4" />
                {dict.tech.btn_finish_work}
            </Button>
        );
    }

    if (mode === "blocked-other-session") {
        return (
            <div className="rounded-2xl border border-orange-500/25 bg-orange-500/10 px-4 py-3.5 text-center text-xs font-semibold text-orange-700 dark:text-orange-300">
                {dict.tech.shift_finish_other_first}
            </div>
        );
    }

    if (mode === "start") {
        return (
            <Button
                disabled={updatingStatus}
                onClick={onStartWork}
                className={primaryCtaClass}
            >
                <Play className="h-4 w-4 fill-white" />
                {dict.tech.btn_start_work}
            </Button>
        );
    }

    if (mode === "completed") {
        return (
            <div className="billing-block rounded-2xl px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-accent">
                {dict.tech.msg_completed}
            </div>
        );
    }

    if (mode === "not-assigned") {
        return (
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3.5 text-center text-xs font-semibold text-orange-700 dark:text-orange-300">
                {dict.tech.msg_not_assigned}
            </div>
        );
    }

    return (
        <Button
            disabled
            variant="outline"
            className="h-11 w-full cursor-not-allowed rounded-xl text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
        >
            <Play className="h-4 w-4" />
            {dict.tech.msg_accept_first}
        </Button>
    );
}
