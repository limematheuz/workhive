"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        // No opacity/transform animations: both break backdrop-filter frost.
        "fixed inset-0 z-[10000] dialog-glass-overlay",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  compact = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  overlayClassName?: string
  /** Content-height dialog used for compact forms with an internal scroll area. */
  compact?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        data-slot={compact ? "dialog-content-standard" : "dialog-content"}
        aria-describedby={undefined}
        className={cn(
          // Compact uses the stock shadcn positioning and deliberately avoids
          // the app's frosted sheet overrides, which are designed for large sheets.
          compact
            ? "fixed top-1/2 left-1/2 z-[10001] grid w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[28px] border border-[var(--border-soft)] border-t-[3px] !border-t-[var(--accent-color)] bg-[var(--bg-card-solid)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none"
            : "dialog-glass fixed inset-0 z-[10001] m-auto grid h-fit max-h-[min(92vh,calc(100%-2rem))] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-[28px] border border-[var(--border-soft)] border-t-[3px] !border-t-[var(--accent-color)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 z-50 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full ui-motion focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:pointer-events-none"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.5} />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline" className="border border-[var(--border-color)]">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-xl leading-tight font-black text-[var(--text-main)]", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm font-medium leading-relaxed text-[var(--text-muted)]", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
