"use client";

import Link from "next/link";
import { useDictionary } from "@/lib/dictionary-context";

export default function DashboardNotFound() {
    const { dict } = useDictionary();

    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
            <div className="text-8xl font-black text-accent/20 select-none">404</div>
            <h2 className="text-2xl font-bold text-[var(--text-main)]">
                {dict.dashboard.not_found_title || "Página no encontrada"}
            </h2>
            <p className="text-[var(--text-muted)] max-w-md">
                {dict.dashboard.not_found_description || "La sección que buscas no existe o aún no ha sido implementada."}
            </p>
            <Link
                href="/dashboard"
                className="px-6 py-3 bg-accent text-black font-semibold rounded-xl hover:bg-accent/90 ui-motion shadow-[0_0_20px_rgba(0,230,118,0.15)]"
            >
                {dict.dashboard.not_found_back || "Volver al Dashboard"}
            </Link>
        </div>
    );
}
