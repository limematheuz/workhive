"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { Check, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({ className, sideOffset = 8, style, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} style={{ backgroundColor: "var(--popover-surface-bg)", ...style }} className={cn("z-[10110] min-w-40 overflow-hidden rounded-xl border border-[var(--popover-surface-border)] p-1 shadow-[var(--popover-surface-shadow)]", className)} {...props} /></DropdownMenuPrimitive.Portal>
}

function DropdownMenuItem({ className, variant = "default", ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return <DropdownMenuPrimitive.Item data-slot="dropdown-menu-item" data-variant={variant} className={cn("flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-colors hover:bg-[var(--bg-tertiary)] data-[highlighted]:bg-[var(--bg-tertiary)] data-[highlighted]:text-[var(--text-main)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50", variant === "destructive" ? "text-[var(--btn-cancel-text)] hover:bg-[var(--btn-cancel-bg)] data-[highlighted]:bg-[var(--btn-cancel-bg)] data-[highlighted]:text-[var(--btn-cancel-text)]" : "text-[var(--text-main)]", className)} {...props} />
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-[var(--border-soft)]", className)} {...props} />
}

function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return <DropdownMenuPrimitive.Label data-slot="dropdown-menu-label" className={cn("px-3 py-2 text-[11px] font-semibold text-muted-foreground", className)} {...props} />
}

function DropdownMenuCheckboxItem({ className, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return <DropdownMenuPrimitive.CheckboxItem data-slot="dropdown-menu-checkbox-item" className={cn("relative flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 pl-9 text-xs font-medium text-[var(--text-main)] outline-none data-[highlighted]:bg-[var(--bg-tertiary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...props}><span className="absolute left-3 flex size-4 items-center justify-center"><DropdownMenuPrimitive.ItemIndicator><Check aria-hidden="true" className="size-3.5" /></DropdownMenuPrimitive.ItemIndicator></span>{children}</DropdownMenuPrimitive.CheckboxItem>
}

function DropdownMenuRadioGroup(props: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return <DropdownMenuPrimitive.RadioItem data-slot="dropdown-menu-radio-item" className={cn("relative flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-3 pl-9 text-xs font-medium text-[var(--text-main)] outline-none data-[highlighted]:bg-[var(--bg-tertiary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)} {...props}><span className="absolute left-3 flex size-4 items-center justify-center"><DropdownMenuPrimitive.ItemIndicator><Circle aria-hidden="true" className="size-2 fill-current" /></DropdownMenuPrimitive.ItemIndicator></span>{children}</DropdownMenuPrimitive.RadioItem>
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem }
