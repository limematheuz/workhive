"use client";

import React from "react";
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

export function TechTaskWorkControls({
    mode,
    updatingStatus,
    dict,
    onStartWork,
    onFinishWork,
}: TechTaskWorkControlsProps) {
    if (mode === "finish") {
        return (
            <div className="pt-2">
                <Button
                    disabled={updatingStatus}
                    onClick={onFinishWork}
                    className="w-full bg-accent hover:bg-accent-light text-white font-black py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 border-none cursor-pointer text-sm uppercase tracking-wider transition-all duration-200"
                >
                    <CheckCircle2 className="w-4 h-4" />
                    {dict.tech.btn_finish_work}
                </Button>
            </div>
        );
    }

    if (mode === "blocked-other-session") {
        return (
            <div className="pt-2">
                <div className="bg-orange-500/10 border border-orange-500/25 text-orange-700 dark:text-orange-300 text-xs font-black text-center py-4 px-4 rounded-2xl">
                    {dict.tech.shift_finish_other_first}
                </div>
            </div>
        );
    }

    if (mode === "start") {
        return (
            <div className="pt-2">
                <Button
                    disabled={updatingStatus}
                    onClick={onStartWork}
                    className="w-full bg-accent hover:bg-accent-light text-white font-black py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 border-none cursor-pointer text-sm uppercase tracking-wider transition-all duration-200"
                >
                    <Play className="w-4 h-4 fill-white" />
                    {dict.tech.btn_start_work}
                </Button>
            </div>
        );
    }

    if (mode === "completed") {
        return (
            <div className="pt-2">
                <div className="bg-accent/10 border border-accent/20 text-accent dark:text-accent text-xs font-black uppercase text-center py-4 rounded-2xl">
                    {dict.tech.msg_completed}
                </div>
            </div>
        );
    }

    if (mode === "not-assigned") {
        return (
            <div className="pt-2">
                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-4 text-center text-xs font-black text-orange-700 dark:text-orange-300">
                    {dict.tech.msg_not_assigned}
                </div>
            </div>
        );
    }

    return (
        <div className="pt-2">
            <div className="bg-[var(--bg-primary)] border border-[var(--border-soft)] text-[var(--text-muted)] text-xs font-black uppercase text-center py-4 rounded-2xl">
                {dict.tech.msg_accept_first}
            </div>
        </div>
    );
}
