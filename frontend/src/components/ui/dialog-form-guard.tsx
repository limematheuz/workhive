"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useDictionary } from "@/lib/dictionary-context";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./alert-dialog";

type CloseGuard = (close: () => void) => void;
const GuardContext = React.createContext<{
    register: (guard: CloseGuard) => () => void;
    dismiss: () => void;
} | null>(null);
type ResetDirty = (scope?: Element) => void;
const ResetDirtyContext = React.createContext<ResetDirty>(() => {});

export function DialogFormGuardResetProvider({ reset, children }: React.PropsWithChildren<{ reset: ResetDirty }>) {
    return <ResetDirtyContext.Provider value={reset}>{children}</ResetDirtyContext.Provider>;
}

export function useDialogFormGuardReset() {
    return React.useContext(ResetDirtyContext);
}

/** Radix dismissals are guarded; a parent's successful-save close is not. */
export function GuardedDialogRoot({ open, defaultOpen = false, onOpenChange, ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const guard = React.useRef<CloseGuard | null>(null);
    const changeOpen = React.useCallback((next: boolean) => {
        const apply = () => {
            setUncontrolledOpen(next);
            onOpenChange?.(next);
        };
        if (!next && guard.current) guard.current(apply);
        else apply();
    }, [onOpenChange]);
    const register = React.useCallback((next: CloseGuard) => {
        guard.current = next;
        return () => { if (guard.current === next) guard.current = null; };
    }, []);
    const context = React.useMemo(() => ({ register, dismiss: () => changeOpen(false) }), [changeOpen, register]);
    return <GuardContext.Provider value={context}>
        <DialogPrimitive.Root {...props} open={open ?? uncontrolledOpen} onOpenChange={changeOpen} />
    </GuardContext.Provider>;
}

/** Use for a custom cancel action inside a form instead of closing its parent directly. */
export function useDialogDismiss(fallback: () => void) {
    return React.useContext(GuardContext)?.dismiss ?? fallback;
}

export function useDialogFormGuard(enabled: boolean) {
    const context = React.useContext(GuardContext);
    const { dict } = useDictionary();
    const dirty = React.useRef(new Set<Element>());
    const pendingClose = React.useRef<(() => void) | null>(null);
    const [confirming, setConfirming] = React.useState(false);
    const resetDirty = React.useCallback((scope?: Element) => {
        if (!scope) return dirty.current.clear();
        // A saved section must not clear changes made elsewhere in the dialog.
        for (const target of dirty.current) {
            if (scope.contains(target)) dirty.current.delete(target);
        }
    }, []);

    React.useEffect(() => {
        if (!context || !enabled) return;
        const guard: CloseGuard = (close) => {
            if (dirty.current.size === 0) return close();
            pendingClose.current = close;
            setConfirming(true);
        };
        return context.register(guard);
    }, [context, enabled]);

    const markFieldChange = (event: React.SyntheticEvent) => {
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
            if (!target.disabled && (!("readOnly" in target) || !target.readOnly)) dirty.current.add(target);
        }
    };
    const markControlChange = (event: React.SyntheticEvent) => {
        if (!(event.target instanceof Element)) return;
        // Radix options render in a portal, but React capture still reaches this dialog.
        const control = event.target.closest('[role="option"], [role="checkbox"], [role="radio"], [role="switch"], [aria-pressed], [data-dirty-control]');
        if (control && !control.matches(':disabled, [aria-disabled="true"], [data-disabled]')) dirty.current.add(control);
    };
    const discard = () => {
        dirty.current.clear();
        setConfirming(false);
        const close = pendingClose.current;
        pendingClose.current = null;
        close?.();
    };

    const confirmation = <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
                <AlertDialogTitle>{dict.formGuard.title}</AlertDialogTitle>
                <AlertDialogDescription>{dict.formGuard.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>{dict.formGuard.keepEditing}</AlertDialogCancel>
                <AlertDialogAction onClick={discard}>{dict.formGuard.discard}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>;

    return { markFieldChange, markControlChange, confirmation, resetDirty };
}
