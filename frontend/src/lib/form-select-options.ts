import { Children, isValidElement, type ReactNode } from "react";
import type { SelectOption } from "./select-options.ts";

function optionText(children: ReactNode): string {
    return Children.toArray(children).map(child => typeof child === "string" || typeof child === "number" ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? optionText(child.props.children) : "").join("");
}
/** Legacy option elements are data only; no native dropdown reaches the DOM. */
export function formSelectOptions(children: ReactNode, group?: { label: string; disabled: boolean }): SelectOption[] {
    return Children.toArray(children).flatMap(child => {
        if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>(child)) return [];
        const props = child.props;
        if (child.type === "option") {
            const label = (props.label ?? optionText(props.children)).replace(/\s+/g, " ").trim();
            return [{ value: props.value == null ? label : String(props.value), label, ...(group?.label ? { description: group.label } : {}), disabled: Boolean(group?.disabled || props.disabled) }];
        }
        const context = child.type === "optgroup" ? { label: props.label ?? "", disabled: Boolean(group?.disabled || props.disabled) } : group;
        return formSelectOptions(props.children, context);
    });
}
