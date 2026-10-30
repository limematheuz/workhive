"use client";

import { useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDialogFormGuardReset } from "@/components/ui/dialog-form-guard";
import { useDictionary } from "@/lib/dictionary-context";

interface TechTaskCommentFormProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (event: FormEvent) => Promise<boolean>;
    saving: boolean;
    onSavingChange: (saving: boolean) => void;
}

export function TechTaskCommentForm({ value, onChange, onSubmit, saving, onSavingChange }: TechTaskCommentFormProps) {
    const { dict } = useDictionary();
    const resetGuard = useDialogFormGuardReset();
    const pending = useRef(false);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (pending.current || !value.trim()) return;
        const form = event.currentTarget;
        pending.current = true;
        onSavingChange(true);
        try {
            if (await onSubmit(event)) resetGuard(form);
        } finally {
            pending.current = false;
            onSavingChange(false);
        }
    };

    return (
        <form onSubmit={submit} aria-busy={saving} className="mt-4 flex flex-col gap-3">
            <Textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-label={dict.tech.comments_placeholder}
                placeholder={dict.tech.comments_placeholder}
                disabled={saving}
                required
                rows={3}
                className="min-h-20 resize-none text-xs"
            />
            <Button
                type="submit"
                disabled={saving || !value.trim()}
                className="flex h-10 cursor-pointer items-center justify-center self-end rounded-2xl border-none bg-accent px-4 text-xs font-black text-white hover:bg-accent-light"
            >
                {dict.tech.comments_submit}
            </Button>
        </form>
    );
}
