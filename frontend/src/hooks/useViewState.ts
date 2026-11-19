"use client";
import {useCallback,useMemo,useState,useSyncExternalStore,type Dispatch,type SetStateAction} from "react";
import {usePathname} from "next/navigation";
import {parseViewValue,viewStateKey} from "@/lib/view-state-storage";
const changed="workhive:view-state";const memory=new Map<string,string>();const serverSnapshot=()=>null;
function identity(){try{return JSON.parse(sessionStorage.getItem("workhive_user_cache:v1")??"null") as {id:number;company_id?:number|null}|null;}catch{return null;}}
function read(key:string){try{return sessionStorage.getItem(key)??memory.get(key)??null;}catch{return memory.get(key)??null;}}
export function useViewState(name:string,initial:string|(()=>string)):[string,Dispatch<SetStateAction<string>>];
export function useViewState(name:string,initial:number|(()=>number)):[number,Dispatch<SetStateAction<number>>];
export function useViewState(name:string,initial:boolean|(()=>boolean)):[boolean,Dispatch<SetStateAction<boolean>>];
export function useViewState<T extends string|number|boolean>(name:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>];
export function useViewState<T extends string|number|boolean>(name:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const path=usePathname();const [fallback]=useState<T>(initial);
 const key=typeof window==="undefined"?viewStateKey(path,null,name):viewStateKey(path,identity(),name);
 const subscribe=useCallback((listener:()=>void)=>{const update=()=>listener();window.addEventListener(changed,update);window.addEventListener("storage",update);return()=>{window.removeEventListener(changed,update);window.removeEventListener("storage",update);};},[]);
 const snapshot=useCallback(()=>read(key),[key]);const raw=useSyncExternalStore(subscribe,snapshot,serverSnapshot);const value=useMemo(()=>parseViewValue(raw,fallback),[raw,fallback]);
 const set=useCallback<Dispatch<SetStateAction<T>>>(next=>{const previous=parseViewValue(read(key),fallback);const resolved=typeof next==="function"?next(previous):next;const serialized=JSON.stringify(resolved);if(serialized.length>4096)return;try{sessionStorage.setItem(key,serialized);}catch{if(memory.size>200)memory.clear();memory.set(key,serialized);}window.dispatchEvent(new Event(changed));},[key,fallback]);return[value,set];
}
