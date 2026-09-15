"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const EMPTY_FILTER_VALUE = "__workhive_empty_filter__";

export type CompactFilterOption = {
    value: string;
    label: string;
};

type CompactFilterSelectProps = {
    value: string;
    onValueChange: (value: string) => void;
    options: CompactFilterOption[];
    "aria-label": string;
    className?: string;
};

export function CompactFilterSelect({
    value,
    onValueChange,
    options,
    "aria-label": ariaLabel,
    className,
}: CompactFilterSelectProps) {
    const selectedValue = value || EMPTY_FILTER_VALUE;

    return (
        <Select
            value={selectedValue}
            onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_FILTER_VALUE ? "" : nextValue)}
        >
            <SelectTrigger className={cn(className)} aria-label={ariaLabel}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem
                        key={option.value || EMPTY_FILTER_VALUE}
                        value={option.value || EMPTY_FILTER_VALUE}
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
