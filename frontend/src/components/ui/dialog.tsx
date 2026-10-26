"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DialogFormGuardResetProvider, GuardedDialogRoot, useDialogFormGuard } from "./dialog-form-guard"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <GuardedDialogRoot data-slot="dialog" {...props} />
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

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  overlayClassName?: string
  compact?: boolean
  confirmDiscard?: boolean
}

function DialogContent({ overlayClassName, ...props }: DialogContentProps) {
  return <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogContentSession {...props} />
  </DialogPortal>
}

// The portal mounts a fresh guard for each opening, including after saving.
function DialogContentSession({
  className,
  children,
  showCloseButton = true,
  compact = false,
  confirmDiscard = true,
  onInputCapture,
  onChangeCapture,
  onClickCapture,
  onKeyDownCapture,
  onPointerUpCapture,
  ...props
}: DialogContentProps) {
  const { markFieldChange, markControlChange, confirmation, resetDirty, markDirty } = useDialogFormGuard(confirmDiscard)

  return (
    <>
      <DialogPrimitive.Content
        data-slot="dialog-content"
        aria-describedby={undefined}
        className={cn(
          compact
            ? "dialog-glass fixed inset-0 z-[10001] m-auto grid h-fit max-h-[min(92vh,calc(100%-2rem))] w-[calc(100vw-2rem)] max-w-2xl gap-4 overflow-y-auto rounded-[28px] border border-[var(--border-soft)] border-t-[3px] !border-t-[var(--accent-color)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none"
            : "dialog-glass fixed inset-0 z-[10001] m-auto grid h-fit max-h-[min(92vh,calc(100%-2rem))] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-[28px] border border-[var(--border-soft)] border-t-[3px] !border-t-[var(--accent-color)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] outline-none sm:max-w-lg",
          className
        )}
        onInputCapture={(event) => {
          markFieldChange(event)
          onInputCapture?.(event)
        }}
        onChangeCapture={(event) => {
          markFieldChange(event)
          onChangeCapture?.(event)
        }}
        onClickCapture={(event) => { markControlChange(event); onClickCapture?.(event) }}
        onPointerUpCapture={(event) => { markControlChange(event); onPointerUpCapture?.(event) }}
        onKeyDownCapture={(event) => {
          if (event.key === " " || event.key === "Enter") markControlChange(event)
          onKeyDownCapture?.(event)
        }}
        {...props}
      >
        <DialogFormGuardResetProvider reset={resetDirty} mark={markDirty}>{children}</DialogFormGuardResetProvider>
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
      {confirmation}
    </>
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
          <Button variant="cancel">Close</Button>
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
