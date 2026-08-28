"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function DropdownMenu(props: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({ className, sideOffset = 6, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn("z-50 min-w-40 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-1 shadow-xl", className)} {...props} /></DropdownMenuPrimitive.Portal>
}

function DropdownMenuItem({ className, variant = "default", ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return <DropdownMenuPrimitive.Item data-slot="dropdown-menu-item" data-variant={variant} className={cn("flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold outline-none transition-colors data-[highlighted]:bg-[var(--bg-tertiary)] data-[highlighted]:text-[var(--text-main)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50", variant === "destructive" ? "text-[var(--btn-cancel-text)] data-[highlighted]:bg-[var(--btn-cancel-bg)] data-[highlighted]:text-[var(--btn-cancel-text)]" : "text-[var(--text-main)]", className)} {...props} />
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return <DropdownMenuPrimitive.Separator data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1 h-px bg-[var(--border-soft)]", className)} {...props} />
}

export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger }
