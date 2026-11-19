import {expect,test,type BrowserContext,type Page} from "@playwright/test";

const actor={id:701,email:"worker-qa@example.test",full_name:"María · Equipo de limpieza y mantenimiento de edificios",role_id:1,role:{id:1,name:"admin"},company_id:91,is_active:true};
const title="Limpieza de la planta cuarta · salas, pasillos y almacén de materiales";
const date=new Date();date.setHours(10,0,0,0);
const task={id:301,title,description:"Trabajo asignado",unit:"servicio",price:999,quantity:2,location_id:11,user_id:701,status:"accepted",priority:"medium",scheduled_start_at:date.toISOString(),due_at:date.toISOString(),is_invoiced:false,created_at:date.toISOString(),updated_at:date.toISOString(),checklist_items:[{id:41,position:0,text:"Limpiar los espacios asignados",completed:false,assignments:[{user_id:701,user_name:"María",status:"accepted"}]}],assignments:[{user_id:701,user_name:"María",status:"accepted",source:"direct"}],spaces:[{id:51,space_id:51,name:"Planta cuarta · zona este",zone_type:"office"}]};
const features=["features.work_orders","features.time_tracking","features.hr"];

async function fixture(context:BrowserContext,page:Page,{linked=true,track=true}={}){
 const base=test.info().project.use.baseURL;
 if(!base)throw new Error("E2E_BASE_URL is required");
 const payload=Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString("base64url");
 await context.addCookies([{name:"auth_token",value:"fixture."+payload+".signature",url:base}]);
 await page.addInitScript(()=>localStorage.setItem("locale","es"));
 let disconnected=false,failPhoto=true;
 const partEvents:string[]=[],photoEvents:string[]=[];
 let submitted:Record<string,unknown>|null=null;
 await page.route("**/api/v1/**",async route=>{
  if(disconnected){await route.abort("internetdisconnected");return;}
  const request=route.request(),path=new URL(request.url()).pathname.replace(/\/$/,"");
  let body:unknown=[];
  if(path==="/api/v1/users/me")body=actor;
  else if(path==="/api/v1/worker-workspace")body={employee:linked?{id:31,name:actor.full_name,position:"Limpiadora"}:null,features,can_track_time:track};
  else if(path==="/api/v1/session/companies")body={current_company_id:91,companies:[{id:91,name:"Empresa de limpieza QA",access_class:"admin",disabled:false}]};
  else if(path==="/api/v1/task-items")body=[task];
  else if(path==="/api/v1/locations")body=[{id:11,name:"Centro logístico y oficinas de administración · Edificio Norte",address:"Calle de prueba 1",city:"Madrid"}];
  else if(path==="/api/v1/offline-work"&&request.method()==="POST"){submitted=request.postDataJSON();partEvents.push(String(submitted?.event_id));body={...submitted,id:801,user_id:701,status:"pending"};}
  else if(path==="/api/v1/offline-work")body=submitted?[{...submitted,id:801,user_id:701,status:"pending"}]:[];
  else if(path==="/api/v1/worker-workspace/photos"){
   const raw=request.postDataBuffer()?.toString("latin1")??"";
   const event=raw.match(/name="client_event_id"\r\n\r\n([^\r]+)/)?.[1]??"";
   photoEvents.push(event);
   expect(raw).toContain('name="expected_user_id"');
   expect(raw).toContain('name="expected_company_id"');
   if(failPhoto){failPhoto=false;await route.fulfill({status:503,json:{detail:"La foto sigue pendiente de sincronizar."}});return;}
   body={id:901};
  }
  await route.fulfill({json:body});
 });
 return {partEvents,photoEvents,offline:async(value:boolean)=>{disconnected=value;await context.setOffline(value);}};
}

test("worker mobile shows own operations and clear missing-link and disabled-clock states",async({context,page})=>{
 await page.setViewportSize({width:390,height:844});
 await fixture(context,page,{linked:false,track:false});
 await page.goto("/worker");
 await expect(page.getByRole("heading",{name:"Mi jornada",exact:true})).toBeVisible();
 await expect(page.getByText("Tu cuenta aún no está vinculada a una ficha de trabajador.",{exact:false})).toBeVisible();
 const nav=page.getByRole("navigation",{name:"App del trabajador"});
 await expect(nav.getByRole("link")).toHaveCount(4);
 await expect(page.getByRole("button",{name:/Sincronizar/})).toBeDisabled();
 await expect(page.getByText("Registrar un parte y fotos en este dispositivo",{exact:true})).toHaveCount(0);
 await nav.getByRole("link",{name:"Fichaje",exact:true}).click();
 await expect(page.getByText("Tu cuenta no tiene el fichaje habilitado",{exact:false})).toBeVisible();
 await page.getByRole("link",{name:"Mis documentos",exact:true}).click();
 await expect(page.getByText("La empresa debe vincular esta cuenta a tu ficha",{exact:false})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test("worker prepares a real shell, retains binary photos offline and retries with the same event identities",async({context,page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:390,height:844});
 const flow=await fixture(context,page);
 await page.goto("/worker");
 await expect(page.getByRole("heading",{name:"Mi jornada",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Preparar mi jornada",exact:true}).click();
 await expect(page.getByText("App y trabajos preparados.",{exact:false})).toBeVisible({timeout:60000});
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const manifest=await page.request.get("/worker/manifest.webmanifest");
 expect(await manifest.json()).toMatchObject({start_url:"/worker",scope:"/worker",display:"standalone"});
 await page.getByText("Registrar un parte y fotos en este dispositivo",{exact:true}).click();
 const form=page.locator("form").filter({has:page.getByRole("heading",{name:title,exact:true})});
 const yesterday=await page.evaluate(()=>{const day=new Date();day.setDate(day.getDate()-1);day.setHours(0,0,0,0);return day.getTime();});
 await form.getByRole("button",{name:"Abrir calendario",exact:true}).nth(0).click();
 await page.locator('button[data-day="'+yesterday+'"]').click();
 await form.getByRole("button",{name:"Abrir calendario",exact:true}).nth(1).click();
 await page.locator('button[data-day="'+yesterday+'"]').click();
 await form.locator("#offline-end-301-time").click();
 await page.getByRole("option",{name:"10:00",exact:true}).click();
 await form.getByLabel("Parte de trabajo",{exact:true}).fill("Limpieza realizada. Foto de comprobación guardada sin conexión.");
 await form.getByRole("checkbox").check();
 await form.locator('input[type="file"]').setInputFiles({name:"evidencia.png",mimeType:"image/png",buffer:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=","base64")});
 await form.getByRole("button",{name:"Guardar parte en el dispositivo",exact:true}).click();
 await expect(page.getByText("1 partes y 1 fotos pendientes",{exact:false})).toBeVisible();
 const stored=await page.evaluate(()=>new Promise<{binary:boolean;price:unknown}>(resolve=>{
  const open=indexedDB.open("workhive-offline",2);
  open.onsuccess=()=>{const db=open.result,tx=db.transaction(["days","worker_photos"]);const photos=tx.objectStore("worker_photos").getAll();const day=tx.objectStore("days").get("91:701");tx.oncomplete=()=>{resolve({binary:photos.result[0]?.file instanceof Blob,price:day.result.tasks[0].price});db.close();};};
 }));
 expect(stored).toEqual({binary:true,price:null});
 await flow.offline(true);
 await page.reload();
 await expect(page.getByRole("heading",{name:"Mi jornada",exact:true})).toBeVisible({timeout:30000});
 await expect(page.getByText("Sin conexión. Los partes y fotos",{exact:false})).toBeVisible();
 await page.getByRole("navigation",{name:"App del trabajador"}).getByRole("link",{name:"Mis trabajos",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Mis trabajos",exact:true})).toBeVisible();
 await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();
 await page.getByRole("navigation",{name:"App del trabajador"}).getByRole("link",{name:"Jornada",exact:true}).click();
 await expect(page.getByText("1 partes y 1 fotos pendientes",{exact:false})).toBeVisible();
 await flow.offline(false);
 await page.getByRole("button",{name:"Sincronizar 1",exact:true}).click();
 await expect(page.getByText("La foto sigue pendiente de sincronizar.",{exact:true})).toBeVisible();
 await expect(page.getByText("1 partes y 1 fotos pendientes",{exact:false})).toBeVisible();
 await page.getByRole("button",{name:"Sincronizar 1",exact:true}).click();
 await expect(page.getByText("0 partes y 0 fotos pendientes",{exact:false})).toBeVisible();
 expect(flow.partEvents).toHaveLength(2);
 expect(new Set(flow.partEvents).size).toBe(1);
 expect(flow.photoEvents).toHaveLength(2);
 expect(flow.photoEvents[0]).not.toBe("");
 expect(new Set(flow.photoEvents).size).toBe(1);
 await page.getByText("Mis partes enviados",{exact:true}).click();
 await expect(page.getByText("Pendiente de revisión",{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>Object.values(localStorage).some(value=>String(value).includes("iVBOR")))).toBe(false);
 expect(await page.evaluate(async()=>{const cache=await caches.open("workhive-worker-shell-v1");return (await cache.keys()).some(request=>new URL(request.url).pathname.startsWith("/api/"));})).toBe(false);
});
