"use client";
import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { getErrorMessage } from "@/lib/errors";
import type { RecordTarget } from "@/lib/record-deep-link";

type Phase = "idle" | "loading" | "ready" | "failed";
type State<T> = { key: string; phase: Phase; record: T | null; error: string | null };

// Every response and displayed value belongs to the same actor, company and URL selection.
export function useLinkedRecord<T extends { id: number }>(enabled: boolean, scope: string, target: RecordTarget,
        read: (id: number, signal?: AbortSignal) => Promise<T>, failureMessage: string) {
    const [revision, setRevision] = useState(0);
    const key = `${scope}:${target.present}:${target.id}:${revision}`;
    const [state, setState] = useState<State<T>>({ key: "", phase: "idle", record: null, error: null });
    useEffect(() => {
        if (!enabled || target.id === null) return;
        let active = true;
        const controller = new AbortController();
        read(target.id, controller.signal).then(record => {
            if (record.id !== target.id) throw new Error("La respuesta no corresponde al registro solicitado.");
            if (active) setState({ key, phase: "ready", record, error: null });
        }).catch(cause => {
            if (active) setState({ key, phase: "failed", record: null, error: getErrorMessage(cause, failureMessage) });
        });
        return () => { active = false; controller.abort(); };
    }, [enabled, target.id, key, read, failureMessage]);
    const phase = !target.present || !enabled ? "idle" : target.error ? "failed"
        : state.key === key ? state.phase : "loading";
    const record = enabled && phase === "ready" && state.key === key ? state.record : null;
    const setRecord = useCallback((update: SetStateAction<T | null>) => setState(current => {
        if (current.key !== key) return current;
        const next = typeof update === "function" ? update(current.record) : update;
        return next && next.id !== target.id ? current : { ...current, record: next };
    }), [key, target.id]);
    return { phase, record, setRecord, error: target.error ?? (state.key === key ? state.error : null),
        retry: () => setRevision(value => value + 1) };
}
