"use client";
import {useUser} from "@/lib/user-context";
import {canViewFinance} from "@/domain/access/roles";
import {ApprovalSettings} from "./ApprovalSettings";
export function CompanyOperationsSettings(){const {user}=useUser();return canViewFinance(user)?<div className="mx-auto w-full max-w-[1600px] px-[3%] pb-6 md:px-8"><ApprovalSettings/></div>:null;}
