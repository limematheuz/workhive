export const costLabels={gross:"Salario bruto",extra:"Pagas extra prorrateadas",bonus:"Complementos",insurance:"Seguridad Social",other:"Otros costes"};
export type CostKey=keyof typeof costLabels;
type CostSource={monthly_hours:string;hourly_cost:string;profile:Record<CostKey,string>};
export function monthlyBreakdown(person:CostSource){return Object.keys(costLabels).reduce((sum,key)=>sum+Number(person.profile[key as CostKey]||0),0);}
export function hourly(person:CostSource){const total=monthlyBreakdown(person),hours=Number(person.monthly_hours);return total>0&&hours>0?total/hours:Number(person.hourly_cost)||0;}
export function monthly(person:CostSource){const total=monthlyBreakdown(person);return total>0?total:hourly(person)*Number(person.monthly_hours);}
