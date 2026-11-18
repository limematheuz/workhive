"use client";
import {useEffect,useEffectEvent} from "react";

// A company or filter change invalidates callbacks from the preceding request.
export function useResourceEffect<T>(enabled:boolean,scopeKey:string,request:()=>Promise<T>,received:(result:T)=>void,failed:(error:unknown)=>void){
    const receive=useEffectEvent(received);
    const fail=useEffectEvent(failed);
    useEffect(()=>{
        if(!enabled)return;
        let active=true;
        request().then(result=>{if(active)receive(result);}).catch(error=>{if(active)fail(error);});
        return()=>{active=false;};
    },[enabled,scopeKey,request]);
}
