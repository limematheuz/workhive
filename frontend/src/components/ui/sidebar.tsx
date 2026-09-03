"use client";

import * as React from "react";
import { Slot } from "radix-ui";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SidebarContextValue = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (open: boolean | ((open: boolean) => boolean)) => void;
    openMobile: boolean;
    setOpenMobile: (open: boolean | ((open: boolean) => boolean)) => void;
    isMobile: boolean;
    toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
    return context;
}

function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const query = window.matchMedia("(max-width: 767px)");
        const update = () => setIsMobile(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);
    return isMobile;
}

function SidebarProvider({ defaultOpen = true, open: controlledOpen, onOpenChange, className, children, ...props }: React.ComponentProps<"div"> & { defaultOpen?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void }) {
    const isMobile = useIsMobile();
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const [openMobile, setOpenMobile] = React.useState(false);
    const open = controlledOpen ?? uncontrolledOpen;
    const setOpen = React.useCallback((value: boolean | ((current: boolean) => boolean)) => {
        const next = typeof value === "function" ? value(open) : value;
        onOpenChange?.(next);
        if (controlledOpen === undefined) setUncontrolledOpen(next);
        document.cookie = `sidebar_state=${next}; path=/; max-age=${60 * 60 * 24 * 7}`;
    }, [controlledOpen, onOpenChange, open]);
    const toggleSidebar = React.useCallback(() => {
        if (isMobile) setOpenMobile(current => !current);
        else setOpen(current => !current);
    }, [isMobile, setOpen]);

    React.useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [toggleSidebar]);

    const value = React.useMemo(() => ({ state: open ? "expanded" as const : "collapsed" as const, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }), [isMobile, open, openMobile, setOpen, toggleSidebar]);
    return <SidebarContext.Provider value={value}><TooltipProvider delayDuration={0}><div data-state={value.state} className={cn("group/sidebar-wrapper flex min-h-dvh w-full", className)} style={{ "--sidebar-width": "15rem", "--sidebar-width-icon": "3.5rem" } as React.CSSProperties} {...props}>{children}</div></TooltipProvider></SidebarContext.Provider>;
}

function Sidebar({ className, children, collapsible = "icon", ...props }: React.ComponentProps<"div"> & { collapsible?: "icon" | "offcanvas" | "none" }) {
    const { isMobile, state, openMobile, setOpenMobile } = useSidebar();
    if (isMobile) return <Sheet open={openMobile} onOpenChange={setOpenMobile}><SheetContent side="left" className={cn("p-0", className)} {...props}><SheetHeader className="sr-only"><SheetTitle>Navegación</SheetTitle><SheetDescription>Navegación principal de WorkHive.</SheetDescription></SheetHeader><div data-sidebar="sidebar" className="flex h-full w-full flex-col">{children}</div></SheetContent></Sheet>;
    return <aside data-sidebar="sidebar" data-state={state} data-collapsible={state === "collapsed" ? collapsible : ""} style={{ width: state === "collapsed" ? "3.5rem" : "15rem" }} className={cn("sticky top-0 hidden h-dvh shrink-0 bg-[var(--bg-primary)] text-[var(--text-main)] md:flex md:flex-col md:transition-[width] md:duration-200", className)} {...props}>{children}</aside>;
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) { return <div data-sidebar="header" className={cn("p-3", className)} {...props} />; }
function SidebarContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-sidebar="content" className={cn("min-h-0 flex-1 overflow-x-hidden px-2 md:overflow-y-hidden", className)} {...props} />; }
function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) { return <div data-sidebar="footer" className={cn("p-3", className)} {...props} />; }
function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) { return <div data-sidebar="group" className={cn("py-1", className)} {...props} />; }
function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) { return <div data-sidebar="group-label" className={cn("px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] group-data-[state=collapsed]/sidebar-wrapper:hidden", className)} {...props} />; }
function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) { return <div data-sidebar="group-content" className={cn("w-full", className)} {...props} />; }
function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) { return <ul data-sidebar="menu" className={cn("flex min-w-0 flex-col gap-1", className)} {...props} />; }
function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) { return <li data-sidebar="menu-item" className={cn("group/menu-item relative", className)} {...props} />; }

const SidebarMenuButton = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean; tooltip?: string }>(({ asChild = false, isActive = false, tooltip, className, children, ...props }, ref) => {
    const { isMobile, state } = useSidebar();
    const isCollapsed = state === "collapsed";
    const Component = asChild ? Slot.Root : "button";
    const button = <Component ref={ref} data-sidebar="menu-button" data-active={isActive} className={cn("flex h-9 w-full items-center gap-3 overflow-hidden rounded-xl px-3 text-left text-sm font-medium text-[var(--text-muted)] outline-none transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] data-[active=true]:bg-[var(--sidebar-active-bg)] data-[active=true]:text-[var(--sidebar-active-text)] [&>span:last-child]:truncate", isCollapsed && "justify-center px-0", className)} {...props}>{children}</Component>;
    if (!tooltip) return button;
    return <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right" align="center" hidden={state !== "collapsed" || isMobile}>{tooltip}</TooltipContent></Tooltip>;
});
SidebarMenuButton.displayName = "SidebarMenuButton";
function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"span">) { return <span data-sidebar="menu-badge" className={cn("ml-auto group-data-[state=collapsed]/sidebar-wrapper:hidden", className)} {...props} />; }
function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) { return <ul data-sidebar="menu-sub" className={cn("ml-5 mt-1 flex flex-col gap-1 border-l border-[var(--border-soft)] pl-3 group-data-[state=collapsed]/sidebar-wrapper:hidden", className)} {...props} />; }
const SidebarMenuSubButton = React.forwardRef<HTMLAnchorElement, React.ComponentProps<"a"> & { asChild?: boolean; isActive?: boolean }>(({ asChild = false, isActive = false, className, ...props }, ref) => { const Component = asChild ? Slot.Root : "a"; return <Component ref={ref} data-sidebar="menu-sub-button" data-active={isActive} className={cn("flex h-8 min-w-0 items-center rounded-lg px-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] data-[active=true]:bg-[var(--sidebar-active-bg)] data-[active=true]:font-medium data-[active=true]:text-[var(--sidebar-active-text)]", className)} {...props} />; });
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";
function SidebarTrigger({ className, ...props }: React.ComponentProps<"button">) { const { toggleSidebar } = useSidebar(); return <button type="button" aria-label="Alternar navegación" data-sidebar="trigger" className={cn("inline-flex size-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]", className)} onClick={toggleSidebar} {...props}><PanelLeft className="size-5" /></button>; }

export { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarProvider, SidebarTrigger, useSidebar };
