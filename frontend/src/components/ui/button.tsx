import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button-variants"

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  Omit<VariantProps<typeof buttonVariants>, "variant"> & {
    variant?: VariantProps<typeof buttonVariants>["variant"] | "custom"
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={variant === "custom" ? cn("focus-visible:ring-2 focus-visible:ring-ring", className) : cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button }
