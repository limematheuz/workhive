import assert from "node:assert/strict";
import test from "node:test";
import {viewStateKey,parseViewValue} from "./view-state-storage.ts";
test("saved list state is isolated by person, active company, route and view",()=>{
 const base=viewStateKey("/dashboard/tasks",{id:1,company_id:2},"status");for(const other of [viewStateKey("/dashboard/tasks",{id:3,company_id:2},"status"),viewStateKey("/dashboard/tasks",{id:1,company_id:4},"status"),viewStateKey("/dashboard/quotes",{id:1,company_id:2},"status"),viewStateKey("/dashboard/tasks",{id:1,company_id:2},"search")])assert.notEqual(base,other);
});
test("corrupt or incompatible browser values safely fall back to valid filter state",()=>{assert.equal(parseViewValue('"accepted"',""),"accepted");assert.equal(parseViewValue('5',1),5);for(const raw of ['null','{}','[]','"text"','broken','1e1000'])assert.equal(parseViewValue(raw,1),1);assert.equal(parseViewValue(JSON.stringify("x".repeat(5000)),""),"");});
