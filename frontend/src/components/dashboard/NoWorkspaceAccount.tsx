"use client";

import { Building2, LogOut, UserRoundX } from "lucide-react";

import { PrivacyControls } from "@/components/profile/PrivacyControls";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/lib/dictionary-context";

export function NoWorkspaceAccount({ onLogout }: { onLogout: () => void }) {
    const { locale } = useDictionary();
    const isSpanish = locale === "es";

    return (
        <main className="min-h-dvh bg-[var(--bg-primary)] px-4 py-8 text-[var(--text-main)] sm:px-6 sm:py-12">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
                <section className="billing-surface billing-surface-accent-pad relative overflow-hidden rounded-[24px]">
                    <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" aria-hidden="true" />
                    <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                <UserRoundX className="h-5 w-5" aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                                    {isSpanish ? "Cuenta WorkHive" : "WorkHive account"}
                                </p>
                                <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                                    {isSpanish ? "Ya no tienes acceso a una empresa" : "You no longer have access to a company"}
                                </h1>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
                                    {isSpanish
                                        ? "Tu identidad y tus datos personales siguen protegidos. Pide una nueva invitación a tu administrador o gestiona tus datos desde aquí."
                                        : "Your identity and personal data remain protected. Ask your administrator for a new invitation or manage your data here."}
                                </p>
                            </div>
                        </div>
                        <Button type="button" variant="outline" onClick={onLogout}>
                            <LogOut className="h-4 w-4" />
                            {isSpanish ? "Cerrar sesión" : "Sign out"}
                        </Button>
                    </div>
                </section>
                <section className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--bg-card)]/45 p-5 text-sm text-[var(--text-muted)]">
                    <div className="flex items-center gap-2 text-[var(--text-main)]">
                        <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
                        <h2 className="font-semibold">{isSpanish ? "Próximos pasos" : "Next steps"}</h2>
                    </div>
                    <p className="mt-2 leading-6">
                        {isSpanish
                            ? "Si necesitas volver a trabajar con una empresa, pídele a un administrador que te invite de nuevo a este mismo correo."
                            : "If you need to work with a company again, ask an administrator to invite this same email address."}
                    </p>
                </section>
                <PrivacyControls locale={locale} canManageRequests={false} />
            </div>
        </main>
    );
}
