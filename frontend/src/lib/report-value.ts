const labels:Record<string,string>={pending:"Pendiente",accepted:"Aceptado",progress:"En curso",review:"En revisión",completed:"Completado",cancelled:"Cancelado",rejected:"Rechazado",open:"Abierta",in_progress:"En curso",resolved:"Resuelta",closed:"Cerrada",low:"Baja",medium:"Media",high:"Alta",critical:"Crítica"};
const dateColumns=new Set(["scheduled","completed","created","resolved"]);
export function reportValue(key:string,value:string|number|null|undefined,dates:Intl.DateTimeFormat):string{
 if(value==null)return "—";
 if((key==="status"||key==="severity")&&typeof value==="string")return labels[value]??value;
 if(dateColumns.has(key)&&typeof value==="string"){
  const date=new Date(value);if(Number.isFinite(date.getTime()))return dates.format(date);
 }
 return String(value);
}
