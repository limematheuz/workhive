import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border-soft)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] [a&]:hover:bg-[var(--btn-primary-hover-bg)]",
        secondary:
          "border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] [a&]:hover:bg-[var(--btn-neutral-hover-bg)]",
        destructive:
          "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] focus-visible:ring-[var(--btn-cancel-border)] [a&]:hover:bg-[var(--btn-cancel-hover-bg)] [a&]:hover:text-[var(--btn-cancel-hover-text)]",
        outline:
          "border-[var(--border-soft)] text-[var(--text-main)] [a&]:hover:bg-[var(--bg-tertiary)]",
        ghost: "text-[var(--text-main)] [a&]:hover:bg-[var(--bg-tertiary)]",
        link: "text-accent underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge }
