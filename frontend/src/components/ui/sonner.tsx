"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--bg-card-solid)",
          "--normal-text": "var(--text-main)",
          "--normal-border": "var(--border-soft)",
          "--success-bg": "var(--bg-card-solid)",
          "--success-text": "var(--text-main)",
          "--success-border": "var(--accent-toast-color)",
          "--error-bg": "var(--bg-card-solid)",
          "--error-text": "var(--text-main)",
          "--error-border": "rgba(239, 68, 68, 0.25)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "shadow-xl w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-auto sm:max-w-[420px]",
          title: "text-sm font-semibold",
          description: "text-xs text-[var(--text-muted)]",
          success: "[&_[data-icon]]:text-accent",
          error: "[&_[data-icon]]:text-red-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
