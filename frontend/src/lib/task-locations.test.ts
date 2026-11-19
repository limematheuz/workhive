import assert from "node:assert/strict";
import test from "node:test";
import {
    readTaskLocationDetails, readTaskLocationSnapshot, taskLocationIds, taskLocationsForScope, taskWorkspaceKey,
    type TaskLocationSnapshot,
} from "./task-locations.ts";
import type { Location } from "../types/location.ts";

const site = (id: number, name: string): Location => ({ id, name, address: name + " 27", city: "Madrid", is_active: true });

test("punctual task details resolve without turning into location creation choices", async () => {
    const master = [site(1, "Oficina")];
    const punctual = site(6, "Servicio puntual");
    const ids = taskLocationIds([{ location_id: 6 }, { location_id: 1 }, { location_id: 6 }]);
    const requests: number[] = [];
    const details = await readTaskLocationDetails(ids, master, async id => { requests.push(id); return punctual; });
    const snapshot = { scope: "8:10:viewer|1", details };
    const taskLocations = taskLocationsForScope(snapshot, snapshot.scope, master, ids);
    assert.deepEqual(requests, [6]);
    assert.equal(taskLocations.find(location => location.id === 6)?.name, "Servicio puntual");
    assert.equal(taskLocations.find(location => location.id === 6)?.address, "Servicio puntual 27");
    assert.deepEqual(master.map(location => location.id), [1]);
    assert.deepEqual(taskLocations.map(location => location.id), [1, 6]);
});

test("late task details retain the request owner and disappear after company, identity or version changes", async () => {
    const first = { id: 8, company_id: 10, role: { name: "viewer" } };
    assert.equal(taskWorkspaceKey(first), "8:10:viewer");
    assert.notEqual(taskWorkspaceKey(first), taskWorkspaceKey({ ...first, company_id: 20 }));
    assert.notEqual(taskWorkspaceKey(first), taskWorkspaceKey({ ...first, id: 9 }));
    assert.notEqual(taskWorkspaceKey(first), taskWorkspaceKey({ ...first, role: { name: "manager" } }));
    let finish!: (location: Location) => void;
    const pending = readTaskLocationSnapshot("8:10:viewer|1", [6], [], () => new Promise<Location>(resolve => { finish = resolve; }));
    const prior: TaskLocationSnapshot = { scope: "8:10:viewer|1", details: [site(6, "Empresa A")] };
    const companyB = [site(20, "Empresa B")];
    for (const nextScope of ["8:20:viewer|1", "9:10:viewer|1", "8:10:viewer|2"]) {
        assert.deepEqual(taskLocationsForScope(prior, nextScope, companyB, [20]), companyB);
    }
    finish(site(6, "Empresa A tardía"));
    const late = await pending;
    assert.equal(late.scope, prior.scope);
    assert.deepEqual(taskLocationsForScope(late, "8:20:viewer|1", companyB, [20]), companyB);
    assert.deepEqual(taskLocationsForScope(late, null, masterWithOldDetails(), [6]), []);
});

function masterWithOldDetails() { return [site(6, "Empresa anterior")]; }

test("denied details clear previous names and hydration only follows current authorized task ids", async () => {
    const master = [site(1, "Oficina")];
    for (const status of [401, 403, 404]) {
        const details = await readTaskLocationDetails([6], master, async () => { throw { status }; });
        assert.deepEqual(taskLocationsForScope({ scope: "8:10|2", details }, "8:10|2", master, [6]), master);
    }
    const previous = { scope: "8:10|2", details: [site(6, "Trabajo anterior")] };
    assert.deepEqual(taskLocationsForScope(previous, previous.scope, master, [9]), master);
    assert.deepEqual(await readTaskLocationDetails([6], master, async () => site(9, "Otra ubicación")), []);
    assert.deepEqual(taskLocationIds([{ location_id: -1 }, { location_id: Number.NaN }, { location_id: 0 }]), []);
});
