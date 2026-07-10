"use client";

import React, { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function getDictionaryText(
    dictionary: unknown,
    path: string[],
    fallback: string
): string {
    let current: unknown = dictionary;
    for (const segment of path) {
        if (!current || typeof current !== "object") return fallback;
        current = (current as Record<string, unknown>)[segment];
    }
    return typeof current === "string" ? current : fallback;
}

interface LocationCheckoutChecklistBuilderProps {
    checklist: string[];
    onChange: (items: string[]) => void;
    dict: unknown;
}

export function LocationCheckoutChecklistBuilder({
    checklist,
    onChange,
    dict,
}: LocationCheckoutChecklistBuilderProps) {
    const [newItem, setNewItem] = useState("");

    const handleAddItem = () => {
        const trimmed = newItem.trim();
        if (!trimmed) return;
        if (checklist.includes(trimmed)) return;
        onChange([...checklist, trimmed]);
        setNewItem("");
    };

    const handleRemoveItem = (index: number) => {
        onChange(checklist.filter((_, i) => i !== index));
    };

    return (
        <div className="p-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] space-y-4">
            <div className="flex flex-col gap-1">
                <Label className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {getDictionaryText(dict, ["tech", "checkout_checklist_label"], "Checkout checks")}
                </Label>
                <p className="text-3xs text-[var(--text-muted)] leading-relaxed">
                    {getDictionaryText(dict, ["tech", "checkout_checklist_desc"], "Mandatory tasks before the worker finishes the shift at this location.")}
                </p>
            </div>
            
            <div className="flex gap-2">
                <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder={getDictionaryText(dict, ["tech", "checkout_checklist_placeholder"], "e.g.: Verify the alarm is set")}
                    className="bg-[var(--bg-tertiary)] border-[var(--border-soft)] text-[var(--text-main)] placeholder-[var(--text-muted)] text-xs h-9"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddItem();
                        }
                    }}
                />
                <Button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-accent hover:bg-accent-light text-white font-bold text-xs px-4 rounded-xl border-none cursor-pointer h-9"
                >
                    {getDictionaryText(dict, ["tasks", "create_dialog", "btn_add"], "Add")}
                </Button>
            </div>

            {checklist.length === 0 ? (
                <p className="text-3xs text-[var(--text-muted)] italic pl-1">
                    {getDictionaryText(dict, ["locations", "form", "checkout_checklist_empty"], "No checkout tasks configured.")}
                </p>
            ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {checklist.map((item, index) => (
                        <div key={item} className="flex items-center justify-between p-2 bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-xl gap-2">
                            <span className="text-xs font-semibold text-[var(--text-main)] break-all pr-2 pl-1">
                                {item}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleRemoveItem(index)}
                                className="text-red-500 hover:text-red-700 font-bold text-sm bg-transparent hover:bg-red-500/10 w-6 h-6 flex items-center justify-center rounded-lg transition-colors border-0 cursor-pointer flex-shrink-0"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
