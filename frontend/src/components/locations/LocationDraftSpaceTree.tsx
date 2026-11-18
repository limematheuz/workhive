import { Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LocationSpace } from "@/types/location";

export function LocationDraftSpaceTree({ spaces, selectedIndex, onSelect }: { spaces: LocationSpace[]; selectedIndex: number; onSelect: (index:number)=>void }) {
    const groups=[...new Set(spaces.map(space=>space.attributes?.shared_space===true?"Compartidos":String(space.attributes?.floor||"Sin planta")))];
    return <section className="wh-panel"><h4 className="wh-panel-title mb-3">Espacios de la ubicación</h4>{groups.map(group=><div key={group} className="mb-4 last:mb-0"><p className="mb-2 text-[11px] font-semibold text-[var(--text-muted)]">{group}</p><div className="wh-space-list">{spaces.map((space,index)=>{
        const name=space.attributes?.shared_space===true?"Compartidos":String(space.attributes?.floor||"Sin planta");
        return name===group?<Button type="button" key={space.id??space.name} variant="ghost" aria-pressed={index===selectedIndex} onClick={()=>onSelect(index)} className="h-auto min-h-11 justify-start whitespace-normal px-2 py-2 text-left text-xs"><Layers3 className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0"><span className="block">{space.name||"Espacio sin nombre"}</span><span className="mt-1 block text-[10px] font-normal text-[var(--text-muted)]">{space.tasks?.filter(task=>task.is_active!==false).length||0} tareas</span></span></Button>:null;
    })}</div></div>)}{!spaces.length&&<p className="text-xs text-[var(--text-muted)]">Añade o sugiere espacios para configurarlos.</p>}</section>;
}
