"use client";
import { useState } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SessionLogoutDialog } from "@/components/applications/SessionLogoutDialog";

export function HeaderAccountMenu({ onLogout }: { onLogout: () => void | Promise<void> }) {
    const { user } = useUser();
    const [open, setOpen] = useState(false);
    if (!user) return null;
    const profile = user.role.name === "client_portal" ? "/dashboard/client/profile" : user.role.name === "partner_portal" ? "/dashboard/partner/profile" : "/dashboard/profile";
    return <><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Cuenta y perfil"><UserAvatar name={user.full_name} email={user.email} photoUrl={user.photo_url} className="size-7" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="max-w-72"><DropdownMenuLabel><span className="block truncate">{user.full_name || "Mi cuenta"}</span><span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem asChild><Link href={profile}><UserRound className="size-4" aria-hidden="true" />Ver perfil</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setOpen(true)}><LogOut className="size-4" aria-hidden="true" />Cerrar sesión</DropdownMenuItem></DropdownMenuContent></DropdownMenu><SessionLogoutDialog open={open} onOpenChange={setOpen} onLogout={onLogout} /></>;
}
