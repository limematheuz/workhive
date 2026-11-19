"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RecordHistoryPanel } from "./RecordHistoryPanel";
import type { RecordEntity } from "@/services/record-history.service";
export function RecordHistoryDialog({record,entityType,close}:{record:{id:number;label:string}|null;entityType:RecordEntity;close:()=>void}){
 return <Dialog open={record!==null} onOpenChange={open=>{if(!open)close();}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Historial de cambios</DialogTitle><DialogDescription>{record?.label}</DialogDescription></DialogHeader>{record&&<RecordHistoryPanel key={record.id} entityType={entityType} entityId={record.id}/>}</DialogContent></Dialog>;
}
