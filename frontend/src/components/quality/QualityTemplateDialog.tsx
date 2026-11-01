"use client";
import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { createEditableLineKey } from "@/lib/editable-line-key";
import { toast } from "@/lib/toast";
import type { QualityLocationOption } from "@/types/quality-access";
import { QualityService, type QualityTemplate } from "@/services/quality.service";

type TemplateItemDraft = { id: string; title: string; max_points: string };
function createTemplateItemDraft(): TemplateItemDraft {
    return { id: createEditableLineKey("quality-template-item"), title: "", max_points: "1" };
}
export function QualityTemplateDialog({ open, onOpenChange, locations, canCreateGlobal, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; locations: QualityLocationOption[]; canCreateGlobal: boolean; onCreated: (template: QualityTemplate) => void }) {
    const [title, setTitle] = React.useState("");
    const [locationId, setLocationId] = React.useState(canCreateGlobal ? "global" : "");
    const [items, setItems] = React.useState<TemplateItemDraft[]>(() => [createTemplateItemDraft()]);
    const [saving, setSaving] = React.useState(false);
    const validLocation = locationId === "global" ? canCreateGlobal : locations.some(location => String(location.id) === locationId);
    const submit = async () => {
        if (!validLocation) return toast.error("Selecciona una ubicación autorizada.");
        if (!title.trim() || items.some((item) => !item.title.trim())) return toast.error("Añade un nombre y al menos un punto de inspección.");
        setSaving(true);
        try {
            const template = await QualityService.createTemplate({ title: title.trim(), location_id: locationId === "global" ? undefined : Number(locationId), items: items.map((item) => ({ title: item.title.trim(), max_points: Number(item.max_points) || 1 })) });
            onCreated(template); onOpenChange(false); setTitle(""); setLocationId(canCreateGlobal ? "global" : ""); setItems([createTemplateItemDraft()]); toast.success("Plantilla de inspección creada.");
        } catch (error) { toast.error(getErrorMessage(error, "No se pudo crear la plantilla.")); } finally { setSaving(false); }
    };
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent compact className="max-w-xl" confirmDiscard><DialogHeader><DialogTitle className="pr-8">Nueva plantilla de inspección</DialogTitle><DialogDescription>Define los puntos que deben revisarse. La plantilla queda separada de los trabajos y conserva su propio historial.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="quality-template-title">Nombre</Label><Input id="quality-template-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisión de salida" /></div><div className="grid gap-2"><Label htmlFor="quality-template-location">Ubicación</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger id="quality-template-location"><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{canCreateGlobal && <SelectItem value="global">Toda la empresa</SelectItem>}{locations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Puntos de inspección</Label>{items.map((item, index) => <div key={item.id} className="flex gap-2"><Input value={item.title} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, title: event.target.value } : value))} placeholder={`Punto ${index + 1}`} /><Input className="w-20" type="number" min="1" max="100" value={item.max_points} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, max_points: event.target.value } : value))} aria-label={`Puntuación máxima del punto ${index + 1}`} />{items.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => current.filter((value) => value.id !== item.id))}>Quitar</Button>}</div>)}<Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setItems((current) => [...current, createTemplateItemDraft()])}><Plus className="size-4" />Añadir punto</Button></div></div><DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving || !validLocation}>{saving && <Loader2 className="size-4 animate-spin" />}Guardar plantilla</Button></DialogFooter></DialogContent></Dialog>;
}
