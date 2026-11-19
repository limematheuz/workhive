import test from "node:test";
import assert from "node:assert/strict";
import { trafficMetrics } from "./traffic/traffic-metrics.ts";
import type { AuditLog } from "../types/audit-log.ts";
const event=(id:number,created_at:string,action="auth.login",actor_user_id:number|null=7,details:AuditLog["details"]={})=>({id,created_at,action,actor_user_id,details}) as AuditLog;
test("traffic windows use current time and exclude future or invalid events",()=>{
    const now=Date.parse("2026-11-19T12:00:00Z");
    const rows=[event(1,"2026-01-01T12:00:00Z"),event(2,"2026-11-18T13:00:00Z"),event(3,"2026-11-15T12:00:00Z"),event(4,"2027-01-01T12:00:00Z"),event(5,"invalid")];
    assert.deepEqual(trafficMetrics(rows,now),{total:3,last24h:1,last7d:2,uniqueUsers:1});
    assert.equal(trafficMetrics([rows[0]],now).last24h,0);
});
test("repeated login events remain events, while anonymous browser IDs never become users",()=>{
    const now=Date.parse("2026-11-19T12:00:00Z");
    const rows=[event(1,"2026-11-19T08:00:00Z","auth.login",7,{user_email:"one@example.test"}),event(2,"2026-11-19T09:00:00Z","auth.login",7,{user_email:"changed@example.test"}),event(3,"2026-11-19T10:00:00Z","public.page_view",null,{visitor_id:"browser-one"}),event(4,"2026-11-19T11:00:00Z","public.page_view",null,{visitor_id:"browser-two"})];
    assert.deepEqual(trafficMetrics(rows,now),{total:4,last24h:4,last7d:4,uniqueUsers:1});
});
