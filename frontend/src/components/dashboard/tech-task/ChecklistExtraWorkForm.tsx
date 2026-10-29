"use client";

import React from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDialogFormGuardReset } from "@/components/ui/dialog-form-guard";
import type { Dictionary } from "@/lib/dictionary-context";
import type { User } from "@/types/user";

export function ChecklistExtraWorkForm({ dict, availableAssignees, onAddChecklistItem }: {
    dict: Dictionary;
    availableAssignees: User[];
    onAddChecklistItem: (question: string, assigneeId: number) => Promise<boolean>;
}) {
    const [newChecklistQuestion, setNewChecklistQuestion] = React.useState("");
    const [newChecklistAssigneeId, setNewChecklistAssigneeId] = React.useState("");
    const resetGuard = useDialogFormGuardReset();
    const addChecklistItem = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const added = await onAddChecklistItem(newChecklistQuestion, Number(newChecklistAssigneeId));
        if (!added) return;
        setNewChecklistQuestion("");
        setNewChecklistAssigneeId("");
        resetGuard(form);
    };
    return (
        <details className="billing-block group overflow-hidden rounded-2xl">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-xs font-semibold text-[var(--text-main)] marker:hidden">
                <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-accent" />
                    {dict.tech.add_checklist_item}
                </span>
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <form
                onSubmit={addChecklistItem}
                className="grid gap-2 border-t border-[var(--border-soft)] p-3.5 sm:grid-cols-[1fr_11rem_auto]"
            >
                <Label htmlFor="new-checklist-question" className="sr-only">
                    {dict.tech.checklist_item_placeholder}
                </Label>
                <Input
                    id="new-checklist-question"
                    type="text"
                    value={newChecklistQuestion}
                    onChange={event => setNewChecklistQuestion(event.target.value)}
                    placeholder={dict.tech.checklist_item_placeholder}
                    required
                    className="h-10 text-xs"
                />
                <Select value={newChecklistAssigneeId} onValueChange={setNewChecklistAssigneeId}>
                    <SelectTrigger aria-label={dict.tech.assign_to_placeholder} className="h-10 text-xs">
                        <SelectValue placeholder={dict.tech.assign_to_placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                    {availableAssignees.map(user => (
                        <SelectItem key={user.id} value={String(user.id)}>{user.full_name || user.email}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <Button
                    type="submit"
                    className="min-h-10 border-none bg-accent px-4 text-xs font-semibold text-white shadow-sm hover:bg-accent-light hover:shadow-sm"
                >
                    {dict.tech.btn_add}
                </Button>
            </form>
        </details>
    );
}
