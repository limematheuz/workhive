"use client";
import Link from "next/link";
import { PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/lib/dictionary-context";

export function ApplicationSwitchLink() {
    const { locale } = useDictionary();
    const label = locale === "en" ? "Switch application" : "Cambiar de aplicación";
    return <Button variant="ghost" size="sm" asChild className="shrink-0 px-2 sm:px-3">
        <Link href="/accesos" aria-label={label}><PanelsTopLeft aria-hidden="true" className="size-4" /><span className="wh-application-switch-label hidden sm:inline">{label}</span></Link>
    </Button>;
}
