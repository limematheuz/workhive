import {apiFetch,assertApiResponseOk} from "@/lib/api";
export async function previewDataImport(kind:string,file:File):Promise<Record<string,unknown>[]> {
    const body=new FormData();body.append("file",file);
    const response=await apiFetch("/api/v1/data-import/preview?kind="+kind,{method:"POST",body});
    await assertApiResponseOk(response,"No se pudo preparar la importación.");
    return response.json();
}
export async function executeDataImport(kind:string,records:Record<string,unknown>[]):Promise<{ids:number[];already_imported:boolean}> {
    const response=await apiFetch("/api/v1/data-import/execute",{method:"POST",body:JSON.stringify({kind,records})});
    await assertApiResponseOk(response,"No se pudo importar.");
    return response.json();
}
