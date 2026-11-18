export function viewStateKey(path:string,identity:{id:number;company_id?:number|null}|null,name:string):string{
 return "workhive:view:v1:"+(identity?identity.id+":"+(identity.company_id??"none"):"public")+":"+encodeURIComponent(path)+":"+encodeURIComponent(name);
}
export function parseViewValue<T extends string|number|boolean>(raw:string|null,fallback:T):T{
 if(!raw||raw.length>4096)return fallback;
 try{const value:unknown=JSON.parse(raw);return typeof value===typeof fallback&&(typeof value!=="number"||Number.isFinite(value))&&(typeof value!=="string"||value.length<=1000)?value as T:fallback;}catch{return fallback;}
}

export function browserViewStateKey(path:string,name:string):string{
 let owner:{id:number;company_id?:number|null}|null=null;
 try{if(typeof sessionStorage!=="undefined")owner=JSON.parse(sessionStorage.getItem("workhive_user_cache:v1")??"null") as typeof owner;}catch{}
 return viewStateKey(path,owner,name);
}
