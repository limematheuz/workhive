"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formControlSurfaceClassName } from "@/components/ui/control-styles";
import { useDialogFormGuardMark } from "@/components/ui/dialog-form-guard";
import { cn } from "@/lib/utils";
import { nextSelectableIndex, searchSelectOptions, type SelectOption } from "@/lib/select-options";

export type { SelectOption } from "@/lib/select-options";
export type SearchableSelectProps = {
    options: readonly SelectOption[]; value: string; onValueChange: (value: string) => void;
    "aria-label": string; placeholder?: string; disabled?: boolean; required?: boolean;
    id?: string; name?: string; className?: string; maxResults?: number; loading?: boolean;
    onSearchChange?: (query: string) => void; searchPlaceholder?: string; emptyMessage?: string;
};

/** Searchable entity chooser. The caller owns data, tenant scope and remote queries. */
export function SearchableSelect({ options, value, onValueChange, "aria-label": label, placeholder = "Seleccionar…", disabled = false, required = false, id, name, className, maxResults = 40, loading = false, onSearchChange, searchPlaceholder = "Buscar…", emptyMessage = "No hay resultados." }: SearchableSelectProps) {
    const generatedId = useId(), listId = `${generatedId}-list`, errorId = `${generatedId}-error`;
    const trigger = useRef<HTMLButtonElement>(null), searchInput = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false), [query, setQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1), [invalid, setInvalid] = useState(false);
    const [remembered, setRemembered] = useState<SelectOption | null>(null);
    const markDirty = useDialogFormGuardMark();
    const selected = options.find(option => option.value === value) ?? (remembered?.value === value ? remembered : null);
    const matches = searchSelectOptions(options, query, maxResults);
    const active = activeIndex >= 0 && activeIndex < matches.items.length && !matches.items[activeIndex].disabled ? activeIndex : nextSelectableIndex(matches.items, -1, 1);
    const activeId = active >= 0 ? `${listId}-${active}` : undefined;
    useEffect(() => { if (open && activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest" }); }, [open, activeId]);
    const changeOpen = (next: boolean) => {
        if (disabled) return;
        setOpen(next);
        if (next) { setQuery(""); setActiveIndex(-1); onSearchChange?.(""); }
    };
    const choose = (option: SelectOption) => {
        if (option.disabled || disabled) return;
        if (option.value !== value) markDirty(trigger.current);
        setRemembered(option); setInvalid(false); onValueChange(option.value); setOpen(false);
    };
    const keyboard = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex(nextSelectableIndex(matches.items, activeIndex, event.key === "ArrowDown" ? 1 : -1)); }
        else if (event.key === "Enter") { event.preventDefault(); if (active >= 0) choose(matches.items[active]); }
        else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    };
    return <div className="min-w-0 w-full"><Popover open={open && !disabled} onOpenChange={changeOpen}>
        <PopoverTrigger asChild><Button ref={trigger} id={id} type="button" role="combobox" aria-label={label} aria-expanded={open && !disabled} aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-required={required} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} disabled={disabled} variant="outline" className={cn("h-10 w-full min-w-0 justify-between rounded-xl border px-3 text-left text-sm font-normal", formControlSurfaceClassName, !selected && (value ? "text-orange-700 dark:text-orange-300" : "text-muted-foreground"), className)} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); changeOpen(true); } }}><span className="min-w-0 truncate">{selected?.label ?? (value ? "Revisar selección…" : placeholder)}</span><ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Button></PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] border border-[var(--border-soft)] p-2" onOpenAutoFocus={event => { event.preventDefault(); searchInput.current?.focus(); }}>
            <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input ref={searchInput} role="combobox" aria-label={`Buscar ${label.toLocaleLowerCase()}`} aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeId} value={query} onChange={event => { const next = event.target.value; setQuery(next); setActiveIndex(-1); onSearchChange?.(next); }} onKeyDown={keyboard} placeholder={searchPlaceholder} autoComplete="off" className="pl-9" /></div>
            <div id={listId} role="listbox" aria-label={`Resultados de ${label.toLocaleLowerCase()}`} aria-busy={loading} className="mt-2 max-h-64 overflow-y-auto overscroll-contain">
                {loading && <p role="status" className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin" />Buscando…</p>}
                {!loading && !matches.items.length && <p role="status" className="px-2 py-3 text-sm text-muted-foreground">{emptyMessage}</p>}
                {matches.items.map((option, index) => <button key={option.value} id={`${listId}-${index}`} type="button" role="option" aria-label={option.label} aria-describedby={option.description ? `${listId}-${index}-description` : undefined} aria-selected={value === option.value} disabled={option.disabled} tabIndex={-1} onPointerMove={() => { if (!option.disabled) setActiveIndex(index); }} onClick={() => choose(option)} className={cn("flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50", index === active && "bg-[var(--btn-secondary-bg)]", value === option.value && "font-medium")}><span className="min-w-0 flex-1"><span className="block truncate">{option.label}</span>{option.description && <span id={`${listId}-${index}-description`} className="mt-0.5 block truncate text-xs text-muted-foreground">{option.description}</span>}</span>{value === option.value && <Check aria-hidden="true" className="size-4 shrink-0 text-accent" />}</button>)}
            </div>
            {matches.hasMore && <p role="status" className="border-t px-2 pt-2 text-xs text-muted-foreground">Hay más resultados. Concreta la búsqueda.</p>}
        </PopoverContent>
    </Popover>
        <input aria-hidden="true" tabIndex={-1} className="sr-only" name={name} value={value} onChange={() => {}} required={required} disabled={disabled} onInvalid={event => { event.preventDefault(); setInvalid(true); changeOpen(true); trigger.current?.focus(); }} />
        {invalid && <p id={errorId} role="alert" className="mt-1 text-xs text-orange-700 dark:text-orange-300">Selecciona una opción de {label.toLocaleLowerCase()}.</p>}
    </div>;
}
