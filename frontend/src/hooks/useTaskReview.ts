"use client";
import { useEffect, useRef, useState } from "react";
import { TaskService } from "@/services/task.service";
import type { TaskItem } from "@/types/user";

export function useTaskReview(items: TaskItem[], onUpdated: () => void, resolveTrigger?: (taskId: number) => HTMLElement | null) {
    const [record, setRecord] = useState<TaskItem | null>(null);
    const [editing, setEditing] = useState(false), [title, setTitle] = useState(""), [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false), [error, setError] = useState("");
    const [pending, setPending] = useState<TaskItem | null | undefined>(undefined);
    const [conflict, setConflict] = useState<TaskItem | null>(null);
    const [notice, setNotice] = useState("");
    const origin = useRef<HTMLElement | null>(null);
    const originTaskId = useRef<number | null>(null);
    const restoreFocus = () => window.requestAnimationFrame(() => {
        const current = originTaskId.current == null ? null : resolveTrigger?.(originTaskId.current);
        const target = current || (origin.current?.isConnected ? origin.current : null);
        target?.focus({ preventScroll: true });
    });
    const dirty = editing && Boolean(record && (title !== record.title || notes !== (record.notes || "")));
    const activate = (task: TaskItem | null) => {
        setRecord(task); setTitle(task?.title || ""); setNotes(task?.notes || ""); setEditing(false); setError(""); setConflict(null); setPending(undefined);
        if (!task) restoreFocus();
    };
    const select = (task: TaskItem | null) => {
        if (!record && task) { originTaskId.current = task.id; if (document.activeElement instanceof HTMLElement) origin.current = document.activeElement; }
        if (dirty) setPending(task); else activate(task);
    };
    const visible = record && items.some(task => task.id === record.id);
    useEffect(() => {
        if (record && !visible && !dirty) { const timer = window.setTimeout(() => { setRecord(null); setNotice("El trabajo ya no coincide con los filtros. El listado se ha actualizado."); origin.current?.focus(); }, 0); return () => window.clearTimeout(timer); }
    }, [record, visible, dirty]);
    useEffect(()=>{
        const latest=record?items.find(task=>task.id===record.id):null;
        if(latest&&!editing&&latest.updated_at!==record?.updated_at){const timer=window.setTimeout(()=>{setRecord(latest);setTitle(latest.title);setNotes(latest.notes||"");},0);return()=>window.clearTimeout(timer);}
    },[items,record,editing]);
    useEffect(() => {
        if (!dirty) return;
        const guard = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", guard);
        return () => window.removeEventListener("beforeunload", guard);
    }, [dirty]);
    const save = async (): Promise<boolean> => {
        if (!record || saving) return false;
        if (!title.trim()) { setError("Escribe el nombre del trabajo."); return false; }
        setSaving(true); setError("");
        try {
            const latest = await TaskService.getTaskItem(record.id);
            if (latest.updated_at !== record.updated_at) { setConflict(latest); setError("Otra persona ha modificado este trabajo. Revisa la versión actual antes de aplicar tu borrador."); return false; }
            const updated = await TaskService.updateTaskItem(record.id, { title: title.trim(), notes });
            setRecord(updated); setTitle(updated.title); setNotes(updated.notes || ""); setEditing(false); setConflict(null); setNotice("Cambios guardados."); onUpdated(); return true;
        } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar. El borrador se conserva."); return false; }
        finally { setSaving(false); }
    };
    return { record, editing, title, notes, dirty, saving, error, pending, conflict, notice, select, restoreFocus, setEditing, setTitle, setNotes, save,
        continueEditing: () => setPending(undefined), discard: () => activate(pending ?? null),
        saveAndContinue: async () => { if (await save()) activate(pending ?? null); },
        reviewConflict: () => { if (conflict) { setRecord(conflict); setConflict(null); setError("Versión actual revisada. Tu borrador se conserva; vuelve a guardar para aplicarlo."); } },
    };
}
