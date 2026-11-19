import {formatCurrency} from "@/lib/format";
const hoursFormatter=new Intl.NumberFormat("es-ES",{maximumFractionDigits:2});
const utcDateFormatter=new Intl.DateTimeFormat("es-ES",{dateStyle:"short",timeStyle:"short",timeZone:"UTC"});
export const reportMoney=(value:string|number|null)=>value===null?"Pendiente":formatCurrency(Number(value));
export const reportHours=(value:string|number)=>hoursFormatter.format(Number(value))+" h";
export const reportUtcDateTime=(value:string)=>utcDateFormatter.format(new Date(value));
