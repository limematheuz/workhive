import * as React from "react"

import { cn } from "@/lib/utils"
import { formControlSurfaceClassName } from "@/components/ui/control-styles"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-md border px-3 py-2 text-base outline-none transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        formControlSurfaceClassName,
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
