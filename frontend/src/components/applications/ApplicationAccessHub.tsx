"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Loader2, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkHiveLogo } from "@/components/brand/WorkHiveLogo";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { clearSessionCache } from "@/lib/auth";
import { type ApplicationAccess, type ApplicationWorkspace } from "@/lib/application-access";
import { authService } from "@/services/auth.service";
import { applicationSession } from "@/services/application-session.service";
import { AuthorizedApplicationCards, PublicApplicationCards } from "./ApplicationAccessCards";

type AccessState = { status: "loading" } | { status: "guest" } | { status: "ready"; workspace: ApplicationWorkspace } | { status: "error"; error: string };
export function ApplicationAccessHub() {
    const [state, setState] = useState<AccessState>({ status: "loading" });
    const [revision, setRevision] = useState(0), [pending, setPending] = useState<string | null>(null), [error, setError] = useState("");
    const request = useCallback(() => applicationSession.list(), []);
    useResourceEffect(true, String(revision), request,
        workspace => setState(workspace ? { status: "ready", workspace } : { status: "guest" }),
        reason => setState({ status: "error", error: reason instanceof Error ? reason.message : "No se pudieron cargar tus accesos." }),
    );
    function reload() { setState({ status: "loading" }); setRevision(value => value + 1); }
    async function select(application: ApplicationAccess) {
        if (pending || state.status !== "ready" || !state.workspace.applications.some(row => row.key === application.key)) return;
        setPending(application.key); setError("");
        try {
            const target = await applicationSession.change(application);
            window.location.assign(new URL(target, window.location.origin).href);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo abrir este acceso.");
            setPending(null); setState({ status: "loading" }); setRevision(value => value + 1);
        }
    }
    async function logout() {
        if (pending) return;
        setPending("logout"); setError("");
        try {
            await authService.logout(); clearSessionCache();
            window.location.assign(new URL("/accesos", window.location.origin).href);
        } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cerrar la sesión."); setPending(null); }
    }
    const signedIn = state.status === "ready";
    return <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8 sm:py-14"><div className="mx-auto max-w-5xl">
        <header className="mb-8 space-y-3"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Link href="/" aria-label="WorkHive, inicio"><WorkHiveLogo className="w-40" priority /></Link>{signedIn && <Button variant="ghost" size="sm" disabled={pending !== null} onClick={() => void logout()}><LogOut aria-hidden="true" className="size-4" />Cerrar sesión</Button>}</div>
            <h1 className="text-3xl font-semibold tracking-tight">{signedIn ? "Elige tu espacio de trabajo" : "Cada persona, su espacio de trabajo"}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{signedIn ? "Una sola cuenta para tus accesos autorizados. Al entrar, se actualizarán la aplicación, la empresa y los permisos de tu sesión." : "Elige tu acceso. Utiliza la cuenta que te ha habilitado la empresa; verás únicamente la información y las acciones que tengas autorizadas."}</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-orange-400/40 bg-orange-500/5 p-4 text-sm text-orange-700 dark:text-orange-300">{error}</p>}
        {state.status === "loading" ? <p role="status" className="flex items-center gap-2 rounded-2xl border p-6 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin" />Consultando tus accesos…</p>
            : state.status === "error" ? <div role="alert" className="space-y-3 rounded-2xl border border-orange-400/40 p-6"><p className="text-sm text-orange-700 dark:text-orange-300">{state.error}</p><Button variant="outline" onClick={reload}><RefreshCw aria-hidden="true" className="size-4" />Volver a intentar</Button></div>
                : state.status === "guest" ? <PublicApplicationCards />
                    : state.workspace.applications.length ? <AuthorizedApplicationCards workspace={state.workspace} pending={pending} onSelect={application => void select(application)} />
                        : <div className="space-y-3 rounded-2xl border border-orange-400/40 p-6"><h2 className="font-semibold">No tienes accesos activos</h2><p className="text-sm text-muted-foreground">Solicita a tu empresa que revise tus autorizaciones. Puedes actualizar esta página después de recibir un acceso.</p><Button variant="outline" onClick={reload}><RefreshCw aria-hidden="true" className="size-4" />Actualizar accesos</Button></div>}
        {pending && <p role="status" className="mt-4 text-sm text-muted-foreground">Actualizando tu sesión de forma segura…</p>}
        <p className="mt-6 text-xs leading-5 text-muted-foreground">Tener una ficha de trabajador o de cliente no crea una cuenta de acceso automáticamente. La empresa gestiona sus autorizaciones desde Portales y aplicaciones.</p>
    </div></main>;
}
