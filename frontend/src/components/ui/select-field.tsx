"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDialogFormGuardMark } from "@/components/ui/dialog-form-guard";
import { useRef } from "react";
import type { SelectOption } from "@/lib/select-options";

export type SelectFieldProps = {
    options: readonly SelectOption[]; value: string; onValueChange: (value: string) => void;
    "aria-label": string; placeholder?: string; disabled?: boolean; required?: boolean;
    id?: string; name?: string; className?: string;
};
export function SelectField({ options, value, onValueChange, "aria-label": label, placeholder = "Seleccionar…", disabled, required, id, name, className }: SelectFieldProps) {
    const trigger = useRef<HTMLButtonElement>(null), markDirty = useDialogFormGuardMark();
    const empty = "__workhive_empty_selection__";
    const emptyLabel = options.find(option => option.value === "")?.label;
    return <Select value={value} onValueChange={next => { const selected = next === empty ? "" : next; if (selected !== value) markDirty(trigger.current); onValueChange(selected); }} disabled={disabled} required={required} name={name}><SelectTrigger ref={trigger} id={id} aria-label={label} className={className}><SelectValue placeholder={emptyLabel ?? placeholder} /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value || empty} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent></Select>;
}
