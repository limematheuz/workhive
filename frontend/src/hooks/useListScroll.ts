"use client";
import {useEffect,useRef,type RefObject} from "react";
import {usePathname} from "next/navigation";
import {browserViewStateKey,parseViewValue} from "@/lib/view-state-storage";
export function useListScroll(name:string,ready:boolean,element:RefObject<HTMLElement|null>){
 const path=usePathname();const key=browserViewStateKey(path,name+".scroll");const restored=useRef<string|null>(null);
 useEffect(()=>{if(!ready||restored.current===key||!element.current||element.current.closest("[role=dialog]"))return;restored.current=key;let top=0;try{top=parseViewValue(sessionStorage.getItem(key),0);}catch{}if(top<=0)return;const frame=requestAnimationFrame(()=>{const region=document.querySelector<HTMLElement>(".dashboard-page-scroll-region");if(region&&getComputedStyle(region).overflowY==="auto")region.scrollTo({top,behavior:"auto"});else window.scrollTo({top,behavior:"auto"});});return()=>cancelAnimationFrame(frame);},[ready,key,element]);
 return ()=>{if(element.current?.closest("[role=dialog]"))return;const region=document.querySelector<HTMLElement>(".dashboard-page-scroll-region");const top=region&&getComputedStyle(region).overflowY==="auto"?region.scrollTop:window.scrollY;try{sessionStorage.setItem(key,JSON.stringify(Math.max(0,top)));}catch{}};
}
