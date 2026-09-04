import assert from "node:assert/strict";
import test from "node:test";

import { isAccountHolderMirror } from "./client-contact-display.ts";
import type { Client, ClientContact } from "../types/client.ts";

const client: Client = {
    id: 1,
    company_id: 1,
    name: "Javier García",
    client_type: "individual",
    relationship_status: "client",
    email: "javier@example.com",
    phone: "+34 607 347 440",
    address: "Calle Mayor 1",
    city: "Madrid",
    postal_code: "28001",
    country: "España",
    is_active: true,
};

const mirror: ClientContact = {
    id: 1,
    client_id: 1,
    full_name: "Javier Garcia",
    email: "JAVIER@example.com",
    phone: "607347440",
    job_title: null,
    roles: [],
    is_primary: true,
    is_active: true,
};

test("account-holder mirrors stay out of additional contacts", () => {
    assert.equal(isAccountHolderMirror(client, mirror), true);
});

test("a real person stays visible even when one contact field matches", () => {
    assert.equal(isAccountHolderMirror(client, {
        ...mirror,
        id: 2,
        full_name: "Ana Responsable",
    }), false);
    assert.equal(isAccountHolderMirror(client, {
        ...mirror,
        id: 3,
        roles: ["billing"],
    }), false);
});
