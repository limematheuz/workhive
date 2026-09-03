"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

const SheetContent = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { side?: "left" | "right" }
>(({ side = "right", className, children, ...props }, ref) => (
    <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
        <SheetPrimitive.Content
            ref={ref}
            className={cn(
                "fixed inset-y-0 z-[101] flex h-dvh w-3/4 flex-col border-[var(--border-soft)] bg-[var(--bg-primary)] shadow-2xl outline-none sm:max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out",
                side === "left" ? "left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left" : "right-0 border-l",
                className,
            )}
            {...props}
        >
            <SheetClose className="absolute right-3 top-3 z-10 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                <X className="h-5 w-5" />
                <span className="sr-only">Cerrar navegación</span>
            </SheetClose>
            {children}
        </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("flex flex-col gap-1", className)} {...props} />;
}

const SheetTitle = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Title ref={ref} className={cn("text-base font-semibold text-[var(--text-main)]", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
    React.ElementRef<typeof SheetPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
    <SheetPrimitive.Description ref={ref} className={cn("text-sm text-[var(--text-muted)]", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger };
