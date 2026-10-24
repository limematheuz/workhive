import assert from "node:assert/strict";
import test from "node:test";

import {
    buildProxyTarget,
    copyAllowedRequestHeaders,
    copyProxyResponseHeaders,
    getConfiguredBackendUrl,
} from "./api-proxy.ts";

test("backend url strips trailing slashes and prefers private backend url", () => {
    assert.equal(
        getConfiguredBackendUrl({
            BACKEND_URL: "https://api.workhive.test///",
            NEXT_PUBLIC_API_URL: "https://public.workhive.test",
        }),
        "https://api.workhive.test",
    );
    assert.equal(
        getConfiguredBackendUrl({
            NEXT_PUBLIC_API_URL: "https://public.workhive.test/",
        }),
        "https://public.workhive.test",
    );
});

test("development proxy falls back to the local backend when env is absent", () => {
    assert.equal(
        getConfiguredBackendUrl({ NODE_ENV: "development" }),
        "http://localhost:8000",
    );
});

test("production proxy never invents a backend url", () => {
    assert.equal(getConfiguredBackendUrl({ NODE_ENV: "production" }), "");
});

test("proxy target keeps path and query on backend origin", () => {
    const target = buildProxyTarget(
        "https://api.workhive.test/base",
        "/api/v1/tasks",
        "?status=open&user=1",
    );
    assert.equal(target.toString(), "https://api.workhive.test/api/v1/tasks?status=open&user=1");
});

test("request header copy allows auth csrf and metadata but drops hop-by-hop headers", () => {
    const source = new Headers({
        accept: "application/json",
        authorization: "Bearer token",
        connection: "keep-alive",
        cookie: "auth=1",
        host: "evil.test",
        "x-csrf-token": "csrf",
        "x-request-id": "req-1",
    });

    const copied = copyAllowedRequestHeaders(source);
    assert.equal(copied.get("accept"), "application/json");
    assert.equal(copied.get("authorization"), "Bearer token");
    assert.equal(copied.get("cookie"), "auth=1");
    assert.equal(copied.get("x-csrf-token"), "csrf");
    assert.equal(copied.get("x-request-id"), "req-1");
    assert.equal(copied.has("connection"), false);
    assert.equal(copied.has("host"), false);
});

test("response header copy preserves body length while dropping unsafe transport headers", () => {
    const source = new Headers({
        "content-type": "application/json",
        "content-length": "99",
        connection: "close",
        "set-cookie": "ignored=1",
    }) as Headers & { getSetCookie?: () => string[] };
    source.getSetCookie = () => ["session=abc; HttpOnly", "csrf=def; SameSite=Lax"];

    const copied = copyProxyResponseHeaders(source);
    assert.equal(copied.get("content-type"), "application/json");
    assert.equal(copied.get("content-length"), "99");
    assert.equal(copied.has("connection"), false);
    assert.deepEqual(copied.getSetCookie(), ["session=abc; HttpOnly", "csrf=def; SameSite=Lax"]);
});
