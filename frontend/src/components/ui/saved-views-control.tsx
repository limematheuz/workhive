"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Link2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSavedViews } from "@/hooks/useSavedViews";
import { listAppearanceStorageKey, readListAppearanceStorage, writeListAppearanceStorage } from "@/hooks/useListAppearance";
import { readListAppearance } from "@/lib/list-appearance";
import { readSharedView, shareViewUrl, viewFilters, type SavedViewState } from "@/lib/saved-views";
import { browserViewStateKey } from "@/lib/view-state-storage";

export function SavedViewsControl({ viewKey, filterKeys, filters, onApply, tableKey, className }: {
    viewKey: string; filterKeys: readonly string[]; filters: Record<string, string>;
    onApply: (values: Record<string, string>) => void; tableKey?: string; className?: string;
}) {
    const path = usePathname(), params = useSearchParams(), saved = useSavedViews(viewKey, filterKeys);
    const [open, setOpen] = useState(false), [name, setName] = useState(""), [message, setMessage] = useState("");
    const [copyFallback, setCopyFallback] = useState("");
    const consumed = useRef("");
    function snapshot(): SavedViewState {
        const values = viewFilters(filters, filterKeys);
        if (!values) throw new Error("No se pudo guardar esta selección de filtros.");
        const appearance = tableKey ? readListAppearance(readListAppearanceStorage(listAppearanceStorageKey(path, tableKey))) : undefined;
        return { version: 1, viewKey, filters: values, ...(appearance ? { appearance } : {}) };
    }
    function apply(view: SavedViewState) {
        if (tableKey && view.appearance) writeListAppearanceStorage(listAppearanceStorageKey(path, tableKey), view.appearance);
        if (tableKey) {
            try { sessionStorage.setItem(browserViewStateKey(path, tableKey + ".page"), "1"); window.dispatchEvent(new Event("workhive:view-state")); } catch { /* The filters remain usable when browser storage is unavailable. */ }
        }
        onApply(view.filters);
        const target = new URL(window.location.href);
        for (const key of filterKeys) {
            if (view.filters[key]) target.searchParams.set(key, view.filters[key]); else target.searchParams.delete(key);
        }
        target.searchParams.delete("wh_view");
        window.history.replaceState(null, "", target.pathname + target.search + target.hash);
    }
    const receiveShared = useEffectEvent((raw: string) => {
        const view = readSharedView(raw, viewKey, filterKeys);
        if (!view) { setMessage("El enlace no contiene una vista válida para esta pantalla."); return; }
        try { apply(view); setMessage("Vista compartida aplicada con tus permisos actuales."); }
        catch { setMessage("No se pudo aplicar toda la vista. Puedes usar los filtros de esta pantalla."); }
    });
    const shared = params.get("wh_view");
    useEffect(() => {
        const token = saved.ownerKey + "|" + shared;
        if (!shared || consumed.current === token) return;
        consumed.current = token; receiveShared(shared);
    }, [shared, saved.ownerKey]);
    function save() {
        try {
            const title = name.trim(); if (!title || title.length > 60) return;
            const existing = saved.views.find(view => view.name.toLocaleLowerCase() === title.toLocaleLowerCase());
            saved.write([{ ...snapshot(), id: existing?.id ?? crypto.randomUUID(), name: title, updatedAt: new Date().toISOString() }, ...saved.views.filter(view => view.id !== existing?.id)]);
            setOpen(false); setName(""); setMessage("Vista guardada para esta cuenta y empresa.");
        } catch { setMessage("No se pudo guardar la vista en este dispositivo. Se conservan tus filtros."); }
    }
    async function share() {
        setCopyFallback("");
        let href: string;
        try { href = shareViewUrl(window.location.href, snapshot()); }
        catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo preparar el enlace."); return; }
        try { await navigator.clipboard.writeText(href); setMessage("Enlace copiado. Cada persona verá sólo sus registros autorizados."); }
        catch { setCopyFallback(href); setMessage("Selecciona el enlace y cópialo para compartir esta vista."); }
    }
    return <div className={className}>
        <div className="flex flex-wrap items-center gap-2"><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm"><Bookmark aria-hidden="true" className="size-4" />Vistas guardadas</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-64 overflow-y-auto"><DropdownMenuLabel>Esta cuenta y empresa</DropdownMenuLabel>
                {saved.views.length ? saved.views.map(view => <DropdownMenuItem key={view.id} onSelect={() => { try { apply(view); setMessage(`Vista «${view.name}» aplicada.`); } catch { setMessage("No se pudo aplicar la vista."); } }}>{view.name}</DropdownMenuItem>) : <p className="px-2 py-2 text-xs text-muted-foreground">Todavía no has guardado vistas.</p>}
                <DropdownMenuSeparator /><DropdownMenuItem onSelect={() => { setName(""); setOpen(true); }}>Guardar vista actual…</DropdownMenuItem>
            </DropdownMenuContent></DropdownMenu><Button type="button" variant="ghost" size="sm" onClick={() => void share()}><Link2 aria-hidden="true" className="size-4" />Compartir vista</Button></div>
        {message && <p role="status" className="mt-1 max-w-xl text-xs text-muted-foreground">{message}</p>}
        {copyFallback && <Input className="mt-2 max-w-xl" aria-label="Enlace de la vista para copiar" readOnly value={copyFallback} onFocus={event => event.currentTarget.select()} />}
        <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Guardar vista</DialogTitle><DialogDescription>Conserva filtros, columnas y orden en este dispositivo para tu cuenta y empresa.</DialogDescription></DialogHeader>
            <div className="space-y-2"><Label htmlFor={"saved-view-name-" + viewKey}>Nombre de la vista</Label><Input id={"saved-view-name-" + viewKey} maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Por ejemplo, mis pendientes de esta semana" onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); save(); } }} /></div>
            <Button type="button" disabled={!name.trim()} onClick={save}>Guardar vista</Button>
            {saved.views.length > 0 && <div className="space-y-1 border-t pt-3"><p className="text-xs font-medium">Vistas existentes</p>{saved.views.map(view => <div key={view.id} className="flex items-center justify-between gap-2"><span className="truncate text-sm">{view.name}</span><Button type="button" variant="ghost" size="icon" aria-label={`Eliminar vista ${view.name}`} onClick={() => { try { saved.write(saved.views.filter(item => item.id !== view.id)); setMessage("Vista eliminada."); } catch { setMessage("No se pudo eliminar la vista."); } }}><Trash2 className="size-4" /></Button></div>)}</div>}
        </DialogContent></Dialog>
    </div>;
}
