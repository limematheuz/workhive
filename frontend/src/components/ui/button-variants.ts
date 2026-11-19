import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ui-motion active:translate-y-px outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]",
        cancel: "border-transparent bg-[var(--btn-neutral-bg)] text-[var(--text-muted)] hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)]",
        destructive: "border-[var(--btn-cancel-hover-bg)] bg-[var(--btn-cancel-hover-bg)] text-[var(--btn-cancel-hover-text)] hover:brightness-95 focus-visible:ring-[var(--btn-cancel-border)]",
        dangerSoft: "border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] hover:bg-[var(--btn-neutral-hover-bg)] focus-visible:ring-[var(--brand-ring)]",
        outline: "border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)]",
        secondary: "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover-bg)]",
        select: "border-[var(--btn-select-border)] bg-[var(--btn-select-bg)] text-[var(--btn-select-text)] hover:bg-[var(--btn-select-hover-bg)]",
        ghost: "border-transparent text-[var(--text-main)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]",
        link: "min-h-0 border-0 bg-transparent p-0 text-accent shadow-none underline-offset-4 hover:bg-transparent hover:underline active:translate-y-0",
      },
      size: {
        default: "min-h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-7 gap-1 rounded-lg px-2 text-[10px] has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-11 px-6 has-[>svg]:px-5",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    compoundVariants: [
      { variant: "link", size: "default", class: "min-h-0 p-0" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
