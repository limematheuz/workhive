"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUser } from "@/lib/user-context";
import { searchResultCount, searchStatusLabel, type WorkspaceSearchItem, type WorkspaceSearchResult } from "@/lib/workspace-search";
import { workspaceSearchService } from "@/services/workspace-search.service";
import { companyViewContext } from "@/lib/company-view-context";

type SearchState = { key: string; data?: WorkspaceSearchResult; error?: string };

export function WorkspaceSearch() {
    const { user } = useUser();
    const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [revision, setRevision] = useState(0);
    const [state, setState] = useState<SearchState | null>(null);
    const resultsRef = useRef<HTMLDivElement>(null);
    const companyId = user?.company_id;
    const allowed = Boolean(companyId && user && !["client_portal", "external_portal", "partner_portal", "superadmin"].includes(user.role.name));
    const term = query.trim().replace(/\s+/g, " ");
    const key = `${companyViewContext(user)}:${term}:${revision}`;

    useEffect(() => {
        if (!allowed) return;
        function shortcut(event: globalThis.KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault(); setOpen(value => !value);
            }
        }
        document.addEventListener("keydown", shortcut);
        return () => document.removeEventListener("keydown", shortcut);
    }, [allowed]);

    useEffect(() => {
        if (!open || !allowed || !companyId || term.length < 2) return;
        let current = true;
        const controller = new AbortController();
        const timer = setTimeout(() => {
            void workspaceSearchService.search(term, companyId, controller.signal).then(
                data => { if (current) setState({ key, data }); },
                reason => { if (current) setState({ key, error: reason instanceof Error ? reason.message : "No se pudo realizar la búsqueda." }); },
            );
        }, 300);
        return () => { current = false; clearTimeout(timer); controller.abort(); };
    }, [open, allowed, companyId, term, key]);

    if (!allowed) return null;
    const result = state?.key === key ? state.data : undefined;
    const error = state?.key === key ? state.error : undefined;
    const count = result ? searchResultCount(result) : 0;
    function navigateResults(event: KeyboardEvent<HTMLDivElement>) {
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        const links = Array.from(resultsRef.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []);
        if (!links.length) return;
        event.preventDefault();
        const index = links.indexOf(document.activeElement as HTMLAnchorElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : event.key === "ArrowDown" ? Math.min(index + 1, links.length - 1) : Math.max(index - 1, 0);
        links[next]?.focus();
    }
    return <>
        <Button variant="ghost" size="sm" aria-label="Buscar en la empresa" onClick={() => setOpen(true)} className="gap-2 px-2 lg:px-3">
            <Search className="size-4" aria-hidden="true" /><span className="hidden lg:inline">Buscar</span><kbd className="hidden rounded border px-1 text-xs text-muted-foreground xl:inline">Ctrl K</kbd>
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="flex max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-4 p-5" confirmDiscard={false}>
                <DialogHeader><DialogTitle>Buscar en la empresa</DialogTitle><DialogDescription>Clientes, ubicaciones, trabajos, documentos y personas a los que tienes acceso.</DialogDescription></DialogHeader>
                <div><label htmlFor="workspace-search" className="mb-1 block text-sm font-medium">Nombre, dirección o referencia</label><Input id="workspace-search" value={query} maxLength={120} autoComplete="off" placeholder="Por ejemplo: Marina, oficina o FAC-2026" onChange={event => setQuery(event.target.value)} aria-describedby="workspace-search-status" onKeyDown={event => { if (event.key === "ArrowDown") { event.preventDefault(); resultsRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus(); } }} /></div>
                <p id="workspace-search-status" role="status" aria-live="polite" className="text-xs text-muted-foreground">{term.length < 2 ? "Escribe al menos 2 caracteres. También puedes buscar jornada, fichaje o parte de trabajo." : error ? "La búsqueda no está disponible." : result ? `${count} coincidencias mostradas${result.groups.some(group => group.has_more) ? " · Hay más resultados; concreta la búsqueda." : ""}` : <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Buscando…</span>}</p>
                {error && <div role="alert" className="rounded-lg border p-3 text-sm"><p>{error}</p><Button className="mt-2" variant="outline" onClick={() => setRevision(value => value + 1)}>Volver a intentar</Button></div>}
                <div ref={resultsRef} onKeyDown={navigateResults} className="min-h-0 overflow-y-auto overscroll-contain">
                    {result && count === 0 && <div className="py-8 text-center"><p className="font-medium">No hay resultados con esta búsqueda</p><p className="mt-1 text-sm text-muted-foreground">Prueba otro nombre, dirección o referencia.</p></div>}
                    {result?.navigation.length ? <ResultGroup label="Ir a una pantalla" items={result.navigation} onOpen={() => setOpen(false)} /> : null}
                    {result?.groups.map(group => group.items.length > 0 ? <ResultGroup key={group.type} label={group.label} items={group.items} onOpen={() => setOpen(false)} /> : null)}
                </div>
            </DialogContent>
        </Dialog>
    </>;
}

function ResultGroup({ label, items, onOpen }: { label: string; items: WorkspaceSearchItem[]; onOpen: () => void }) {
    return <section className="mb-4"><h2 className="mb-1 px-2 text-xs font-semibold text-muted-foreground">{label}</h2><ul className="space-y-1">{items.map(item => <li key={item.key}><Link href={item.href} onClick={onOpen} className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 hover:bg-[var(--brand-blue-soft)] focus-visible:outline-offset-[-2px]"><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.title}</p><p className="break-words text-xs text-muted-foreground">{item.reference ? `${item.reference} · ` : ""}{item.context}</p></div>{item.status && <span className="shrink-0 rounded-full border px-2 py-1 text-xs">{searchStatusLabel(item.status)}</span>}<ArrowUpRight className="size-4 shrink-0 text-accent" aria-hidden="true" /></Link></li>)}</ul></section>;
}
