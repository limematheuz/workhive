"use client";
import { Children, isValidElement, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import type { ListAppearance } from "@/lib/list-appearance";

function text(node: ReactNode): string {
    return Children.toArray(node).map(child => typeof child === "string" || typeof child === "number" ? String(child)
        : isValidElement<{ children?: ReactNode }>(child) ? text(child.props.children) : "").join(" ").trim();
}
export function ListAppearanceMenu({ columns, appearance, change, sortOptions = [] }: {
    columns: { key: string; label: ReactNode; labelText?: string; hideable?: boolean }[];
    appearance: ListAppearance; change: (patch: Partial<ListAppearance>) => void;
    sortOptions?: { value: string; label: string }[];
}) {
    const visible = columns.length - appearance.hidden.length;
    const sort = sortOptions.some(option => option.value === appearance.sort) ? appearance.sort : "default";
    return <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="Vista de la lista: columnas, orden y densidad"><SlidersHorizontal aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Vista</span></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[min(32rem,80dvh)] w-64 overflow-y-auto">
            <DropdownMenuLabel>Densidad</DropdownMenuLabel><DropdownMenuRadioGroup value={appearance.density} onValueChange={value => change({ density: value === "compact" ? "compact" : "comfortable" })}>
                <DropdownMenuRadioItem value="comfortable">Cómoda</DropdownMenuRadioItem><DropdownMenuRadioItem value="compact">Compacta</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            {sortOptions.length > 0 && <><DropdownMenuSeparator /><DropdownMenuLabel>Orden</DropdownMenuLabel><DropdownMenuRadioGroup value={sort} onValueChange={value => change({ sort: value })}>
                <DropdownMenuRadioItem value="default">Orden actual</DropdownMenuRadioItem>{sortOptions.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>{option.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup></>}
            <DropdownMenuSeparator /><DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>{columns.map((column, index) => {
                const checked = !appearance.hidden.includes(column.key);
                return <DropdownMenuCheckboxItem key={column.key} checked={checked} disabled={column.hideable === false || checked && visible <= 1} onSelect={event => event.preventDefault()}
                    onCheckedChange={value => change({ hidden: value ? appearance.hidden.filter(key => key !== column.key) : [...appearance.hidden, column.key] })}>
                    {column.labelText || text(column.label) || `Columna ${index + 1}`}
                </DropdownMenuCheckboxItem>;
            })}
        </DropdownMenuContent>
    </DropdownMenu>;
}
