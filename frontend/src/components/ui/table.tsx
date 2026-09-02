import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto max-md:overflow-visible">
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          "max-md:!min-w-0 max-md:block max-md:[&_thead]:sr-only max-md:[&_tbody]:block",
          "max-md:[&_tr]:mb-2 max-md:[&_tr]:block max-md:[&_tr]:rounded-2xl max-md:[&_tr]:border max-md:[&_tr]:border-[var(--border-soft)] max-md:[&_tr]:bg-[var(--bg-secondary)]/20",
          "max-md:[&_td]:flex max-md:[&_td]:w-full max-md:[&_td]:items-center max-md:[&_td]:justify-between max-md:[&_td]:gap-3 max-md:[&_td]:px-3 max-md:[&_td]:py-2.5",
          className,
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b [&_tr]:border-[var(--border-soft)]", className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={cn("[&_tr:last-child]:border-0", className)} {...props} />
}

function TableRow({ className, onClick, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" onClick={onClick} className={cn("border-b border-[var(--border-soft)] transition-[filter,background-color]", onClick && "cursor-pointer hover:brightness-[0.94]", className)} {...props} />
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th data-slot="table-head" className={cn("h-10 px-3 text-left align-middle font-medium text-[var(--text-muted)]", className)} {...props} />
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-3 py-2 align-middle", className)} {...props} />
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
