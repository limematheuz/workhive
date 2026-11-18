"use client";

import { useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readLocationFloors, withLocationFloors, type LocationFloor } from "@/domain/locations/location-setup";
import type { LocationFeaturesStepProps } from "./location-workspace-types";
import { LocationSpaceCharacteristics } from "./LocationSpaceCharacteristics";
import { LocationRisksSection } from "./LocationRisksSection";
import { LocationServiceWindowsSection } from "./LocationServiceWindowsSection";

export function LocationFeaturesStep({ profile, catalog, setProfile, risks, setRisks, serviceWindows, setServiceWindows }: LocationFeaturesStepProps) {
    const [selectedId, setSelectedId] = useState("floor-0");
    const floors = readLocationFloors(profile);
    const selected = floors.find(floor => floor.id === selectedId) || floors[0];
    const site = catalog?.site_types.find(item => item.id === profile.site_type);
    const templates = site?.space_templates || [];
    const spaceCount = Object.values(selected.counts).reduce((sum, count) => sum + count, 0);
    const updateFloor = (changes: Partial<LocationFloor>) => setProfile(withLocationFloors(profile, floors.map(floor => floor.id === selected.id ? { ...floor, ...changes } : floor)));
    const updateCount = (key: string, value: number) => updateFloor({ counts: { ...selected.counts, [key]: Number.isFinite(value) ? Math.min(100, Math.max(0, Math.floor(value))) : 0 } });
    const addFloor = () => {
        const level = Math.max(...floors.map(floor => floor.level)) + 1;
        const floor = { id: crypto.randomUUID(), name: `Planta ${level}`, level, surface: 0, counts: {} };
        setProfile(withLocationFloors(profile, [...floors, floor]));
        setSelectedId(floor.id);
    };

    return <div className="space-y-5">
        <div><h3 className="text-xl font-semibold">3. Características de la ubicación</h3><p className="wh-panel-subtitle">Selecciona una planta y marca los espacios que tiene. Usa los botones − y + para indicar cuántos hay.</p></div>
        <section className="wh-panel">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h4 className="wh-panel-title">Plantas del edificio</h4><Button type="button" variant="secondary" size="sm" onClick={addFloor} disabled={floors.length >= 100}><Plus className="size-4" />Añadir planta</Button></div>
            <div className="wh-floor-configuration"><div className="wh-floor-selector" role="group" aria-label="Seleccionar planta">{floors.map(floor => <Button key={floor.id} type="button" variant="outline" aria-pressed={floor.id === selected.id} onClick={() => setSelectedId(floor.id)} className="h-auto min-h-14 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left">
                <Building2 className="size-4 shrink-0" /><span><span className="block font-semibold">{floor.name}</span><span className="mt-1 block text-[11px] font-normal text-[var(--text-muted)]">{Object.values(floor.counts).reduce((sum, count) => sum + count, 0)} espacios{floor.surface ? ` · ${floor.surface} m²` : ""}</span></span>
            </Button>)}</div>
            <div className="min-w-0"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_75px_minmax(100px,.65fr)]">
                <div className="space-y-1.5"><Label htmlFor="location-floor-name">Nombre de planta</Label><Input id="location-floor-name" value={selected.name} onChange={event => updateFloor({ name: event.target.value })} maxLength={80} /></div>
                <div className="space-y-1.5"><Label htmlFor="location-floor-level">Nivel</Label><Input id="location-floor-level" type="number" min={0} value={selected.level} onChange={event => updateFloor({ level: Math.max(0, Number(event.target.value)) })} /></div>
                <div className="space-y-1.5"><Label htmlFor="location-floor-area">Superficie (m²)</Label><Input id="location-floor-area" type="number" min={0} value={selected.surface || ""} placeholder="Opcional" onChange={event => updateFloor({ surface: Math.max(0, Number(event.target.value)) })} /></div>
            </div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-[var(--text-muted)]">{spaceCount} espacios seleccionados · {selected.name}</p>{floors.length > 1 && <Button type="button" variant="ghost" size="xs" aria-label={`Quitar ${selected.name} de la configuración`} onClick={() => setProfile(withLocationFloors(profile, floors.filter(floor => floor.id !== selected.id)))}><Trash2 className="size-3.5" />Quitar planta</Button>}</div></div></div>
        </section>
        <section aria-label="Características y cantidad de espacios">
            <div className="mb-3"><h4 className="wh-panel-title">¿Qué espacios hay en esta planta?</h4><p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Cada espacio tendrá las tareas comunes de su tipo. No necesitas definir mobiliario.</p></div>
            <LocationSpaceCharacteristics templates={templates} counts={selected.counts} attributes={profile.attributes} floorName={selected.name} onCountChange={updateCount} onFeatureChange={(key, value) => setProfile({ ...profile, attributes: { ...profile.attributes, [key]: value } })} />
            {!templates.length && <p className="wh-note">Selecciona el tipo de ubicación para ver sus espacios habituales.</p>}
        </section>
        {site?.guidance && <details className="wh-note"><summary className="cursor-pointer font-medium">Recomendaciones para {site.label.toLocaleLowerCase()}</summary><p className="mt-2">{site.guidance}</p></details>}
        <details className="wh-panel"><summary className="cursor-pointer text-sm font-semibold">Más características y operativa <span className="ml-1 font-normal text-[var(--text-muted)]">· Opcional</span></summary><div className="mt-4"><LocationRisksSection risks={risks} setRisks={setRisks} /><LocationServiceWindowsSection serviceWindows={serviceWindows} setServiceWindows={setServiceWindows} /><div className="mt-4 space-y-2"><Label htmlFor="location-service-notes">Observaciones operativas</Label><Textarea id="location-service-notes" value={profile.service_notes || ""} onChange={event => setProfile({ ...profile, service_notes: event.target.value })} placeholder="Zonas delicadas, materiales especiales o instrucciones." /></div></div></details>
        <p className="wh-note">En Espacios y tareas podrás generar y revisar las tareas comunes de los espacios seleccionados. Las zonas compartidas también están disponibles en la biblioteca.</p>
    </div>;
}
