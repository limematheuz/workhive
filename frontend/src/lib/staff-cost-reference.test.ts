import test from "node:test";
import assert from "node:assert/strict";
import {hourly,monthly,monthlyBreakdown} from "../domain/staff/staff-costs.ts";
const person={monthly_hours:"160",hourly_cost:"15",profile:{gross:"0",extra:"0",bonus:"0",insurance:"0",other:"0"}};
test("an imported recorded hourly rate remains available without a salary breakdown",()=>{assert.equal(hourly(person),15);assert.equal(monthly(person),2400);assert.equal(monthlyBreakdown(person),0);});
test("a completed monthly breakdown determines its own hourly reference",()=>{const updated={...person,profile:{...person.profile,gross:"2500",insurance:"700"}};assert.equal(hourly(updated),20);assert.equal(monthly(updated),3200);});
