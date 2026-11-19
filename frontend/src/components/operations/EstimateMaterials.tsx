"use client";
import {FormSelect} from "@/components/ui/form-select";
import Link from "next/link";
import {Plus,Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import type {EstimateMaterial,EstimateOptions} from "@/services/service-estimator.service";
export function EstimateMaterials({options,value,onChange,disabled}:{options:EstimateOptions;value:EstimateMaterial[];onChange:(value:EstimateMaterial[])=>void;disabled:boolean}){
 const update=(index:number,changes:Partial<EstimateMaterial>)=>onChange(value.map((row,i)=>i===index?{...row,...changes}:row));
 const add=()=>{const material=options.materials[0],warehouse=options.warehouses[0];if(material&&warehouse)onChange([...value,{ui_key:crypto.randomUUID(),material_id:material.id,warehouse_id:warehouse.id,quantity:"1"}]);};
 return <section className="space-y-3 rounded-2xl border bg-[var(--bg-card)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Materiales por servicio</h3><p className="text-xs text-muted-foreground">Coste medio de las existencias registradas en cada almacén.</p></div><Button type="button" variant="outline" size="sm" onClick={add} disabled={disabled||!options.materials.length||!options.warehouses.length||value.length>=100}><Plus size={15}/>Añadir material</Button></div>
 {!options.inventory_available?<p className="text-sm text-orange-700">Necesitas permiso de inventario para consultar materiales y sus costes.</p>:!options.materials.length||!options.warehouses.length?<p className="text-sm text-orange-700">Registra materiales y almacenes en <Link className="underline" href="/dashboard/inventory">Inventario</Link> para incluir consumos.</p>:null}
 {!value.length&&<p className="text-sm text-muted-foreground">No se han incluido consumos. Añade los que necesite este servicio.</p>}
 {value.map((row,index)=><fieldset disabled={disabled} key={row.ui_key??row.material_id+":"+row.warehouse_id} className="grid items-end gap-2 rounded-xl bg-muted/40 p-3 sm:grid-cols-[2fr_2fr_1fr_auto]"><label className="text-xs">Material<FormSelect aria-label={"Material"}  value={row.material_id} onValueChange={selectedOptionValue=>update(index,{material_id:Number(selectedOptionValue)})}>{options.materials.map(item=><option key={item.id} value={item.id}>{item.name} · {item.unit}</option>)}</FormSelect></label><label className="text-xs">Almacén<FormSelect aria-label={"Almacén"}  value={row.warehouse_id} onValueChange={selectedOptionValue=>update(index,{warehouse_id:Number(selectedOptionValue)})}>{options.warehouses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</FormSelect></label><label className="text-xs">Cantidad<Input type="number" min=".001" step=".001" value={row.quantity} onChange={e=>update(index,{quantity:e.target.value})}/></label><Button type="button" variant="ghost" size="icon" aria-label={"Quitar material "+(index+1)} onClick={()=>onChange(value.filter((_,i)=>i!==index))}><Trash2 size={16}/></Button></fieldset>)}
 </section>;
}
