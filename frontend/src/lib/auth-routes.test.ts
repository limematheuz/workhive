import assert from "node:assert/strict";
import test from "node:test";

import {
    DEFAULT_POST_LOGIN_PATH,
    applicationHome,
    applicationRoleAllowed,
    isAuthenticationEntryPath,
    requiresAuthenticatedSession,
    resolvePostLoginPath,
} from "./auth-routes.ts";

test("only application actions require an authenticated session", () => {
    assert.equal(requiresAuthenticatedSession("/dashboard"), true);
    assert.equal(requiresAuthenticatedSession("/dashboard/invoices/6"), true);
    assert.equal(requiresAuthenticatedSession("/subscription/checkout"), false);
    assert.equal(requiresAuthenticatedSession("/subscription"), false);
    assert.equal(requiresAuthenticatedSession("/contact"), false);
});

test("post-login routing preserves supported local paths and rejects redirects", () => {
    assert.equal(resolvePostLoginPath("/dashboard/invoices/6?tab=items"), "/dashboard/invoices/6?tab=items");
    assert.equal(resolvePostLoginPath("/subscription/checkout?plan=top"), DEFAULT_POST_LOGIN_PATH);
    assert.equal(resolvePostLoginPath("/accept-company-invitation?token=opaque"), "/accept-company-invitation?token=opaque");
    assert.equal(resolvePostLoginPath("//outside.example"), DEFAULT_POST_LOGIN_PATH);
    assert.equal(resolvePostLoginPath("https://outside.example"), DEFAULT_POST_LOGIN_PATH);
    assert.equal(resolvePostLoginPath("/subscription"), DEFAULT_POST_LOGIN_PATH);
});

test("only login and registration are authentication entry screens", () => {
    assert.equal(isAuthenticationEntryPath("/login"), true);
    assert.equal(isAuthenticationEntryPath("/register"), true);
    assert.equal(isAuthenticationEntryPath("/forgot-password"), false);
    assert.equal(isAuthenticationEntryPath("/subscription"), false);
});

test("dedicated applications retain safe login return paths and role boundaries",()=>{
 for(const path of ["/worker","/worker/jobs?task=8","/portal-cliente","/gestoria"]){assert.equal(requiresAuthenticatedSession(path.split("?")[0]),true);assert.equal(resolvePostLoginPath(path),path);}
 for(const path of ["/worker-evil","/gestoria-falsa"]){assert.equal(requiresAuthenticatedSession(path),false);assert.equal(resolvePostLoginPath(path),DEFAULT_POST_LOGIN_PATH);}
 assert.equal(requiresAuthenticatedSession("/accesos"),false);assert.equal(resolvePostLoginPath("/accesos"),"/accesos");assert.equal(resolvePostLoginPath("/accesos-falso"),DEFAULT_POST_LOGIN_PATH);
 assert.equal(applicationHome("client_portal"),"/portal-cliente");assert.equal(applicationHome("external_portal"),"/gestoria");assert.equal(applicationHome("viewer"),"/worker");assert.equal(applicationHome("admin"),"/dashboard");assert.equal(applicationHome("admin","/worker/jobs"),"/worker/jobs");
 assert.equal(applicationRoleAllowed("worker","viewer",2),true);assert.equal(applicationRoleAllowed("worker","viewer",null),false);assert.equal(applicationRoleAllowed("worker","client_portal",2),false);assert.equal(applicationRoleAllowed("client","admin",2),false);assert.equal(applicationRoleAllowed("adviser","client_portal",null),false);assert.equal(applicationRoleAllowed("client","client_portal",null),true);assert.equal(applicationRoleAllowed("adviser","external_portal",null),true);
});

test("office responsibilities keep a worker-class account in its authorized workspace",()=>{
 assert.equal(applicationHome({role:{name:"viewer"},can_view_finance:true}),"/dashboard");assert.equal(applicationHome({role:{name:"viewer"},can_view_labor_costs:true}),"/dashboard");assert.equal(applicationHome({role:{name:"viewer"},can_view_quality:true}),"/dashboard");assert.equal(applicationHome({role:{name:"viewer"},can_view_finance:false}),"/worker");assert.equal(applicationHome({role:{name:"viewer"},can_view_finance:true},"/worker"),"/worker");
});
