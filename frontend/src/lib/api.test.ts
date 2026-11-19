import assert from "node:assert/strict";
import test from "node:test";
import { readSessionRequestScope } from "./request-read-context.ts";

import {
    ApiResponseError,
    apiFetch,
    assertApiResponseOk,
    extractErrorMessage,
    hasActiveMutations,
    resolveApiMediaUrl,
} from "./api.ts";

class MemoryStorage {
    private data = new Map<string, string>();

    getItem(key: string) {
        return this.data.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.data.set(key, value);
    }

    removeItem(key: string) {
        this.data.delete(key);
    }

    clear() {
        this.data.clear();
    }
}

function installBrowser(pathname = "/dashboard") {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    const replaceCalls: string[] = [];
    Object.defineProperty(globalThis, "localStorage", {
        value: localStorage,
        configurable: true,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
        value: sessionStorage,
        configurable: true,
    });
    Object.defineProperty(globalThis, "document", {
        value: { cookie: "" },
        configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
        value: {
            location: {
                pathname,
                replace: (url: string) => replaceCalls.push(url),
            },
        },
        configurable: true,
    });
    return { localStorage, sessionStorage, replaceCalls };
}

function restoreBrowser() {
    delete (globalThis as Partial<typeof globalThis>).fetch;
    delete (globalThis as Partial<typeof globalThis>).window;
    delete (globalThis as Partial<typeof globalThis>).document;
    delete (globalThis as Partial<typeof globalThis>).localStorage;
    delete (globalThis as Partial<typeof globalThis>).sessionStorage;
}

function jsonResponse(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
    });
}

test("shared collection reads belong to the cached actor and active company", async () => {
    const browser = installBrowser();
    const owner = { id: 7, company_id: 1, role: { name: "admin" }, can_view_labor_costs: true };
    browser.sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify(owner));
    const releases: Array<(response: Response) => void> = [];
    globalThis.fetch = (() => new Promise<Response>(resolve => releases.push(resolve))) as typeof fetch;
    try {
        const first = apiFetch("/api/v1/staff");
        const sameOwner = apiFetch("/api/v1/staff");
        assert.equal(releases.length, 1);
        browser.sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify({ ...owner, company_id: 2 }));
        const nextCompany = apiFetch("/api/v1/staff");
        assert.equal(releases.length, 2);
        releases[1](jsonResponse([{ name: "Company two" }]));
        assert.deepEqual(await (await nextCompany).json(), [{ name: "Company two" }]);
        releases[0](jsonResponse([{ name: "Company one" }]));
        assert.deepEqual(await (await first).json(), [{ name: "Company one" }]);
        assert.deepEqual(await (await sameOwner).json(), [{ name: "Company one" }]);
    } finally { restoreBrowser(); }
});

test("actor, role and permission changes invalidate the read namespace without using credentials", () => {
    const browser = installBrowser();
    const owner = { id: 7, company_id: 1, role: { name: "admin" }, can_view_labor_costs: true };
    try {
        browser.sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify(owner));
        const first = readSessionRequestScope();
        assert.ok(first);
        for (const next of [{ ...owner, id: 8 }, { ...owner, role: { name: "viewer" } }, { ...owner, can_view_labor_costs: false }]) {
            browser.sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify(next));
            assert.notEqual(readSessionRequestScope(), first);
        }
    } finally { restoreBrowser(); }
});

test("missing, invalid and portal context never share in-flight reads", async () => {
    for (const raw of [null, "invalid-json", "null", JSON.stringify({ id: 7, role: { name: "admin" } }),
            JSON.stringify({ id: 7, company_id: 1, role: { name: "client_portal" } })]) {
        const browser = installBrowser();
        if (raw !== null) browser.sessionStorage.setItem("workhive_user_cache:v1", raw);
        let reads = 0;
        globalThis.fetch = (async () => { reads++; return jsonResponse([]); }) as typeof fetch;
        try {
            assert.equal(readSessionRequestScope(), null);
            await Promise.all([apiFetch("/api/v1/scoped-read"), apiFetch("/api/v1/scoped-read")]);
            assert.equal(reads, 2);
        } finally { restoreBrowser(); }
    }
});

test("server reads have no browser identity and remain independent", async () => {
    let reads = 0;
    globalThis.fetch = (async () => { reads++; return jsonResponse([]); }) as typeof fetch;
    try {
        assert.equal(readSessionRequestScope(), null);
        await Promise.all([apiFetch("/api/v1/server-scoped-read"), apiFetch("/api/v1/server-scoped-read")]);
        assert.equal(reads, 2);
    } finally { restoreBrowser(); }
});

test("cancelling one owned read never aborts another read of the same record", async () => {
    const browser = installBrowser();
    browser.sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify({ id: 7, company_id: 1, role: { name: "admin" } }));
    const releases: Array<(response: Response) => void> = [];
    globalThis.fetch = ((_input, init) => new Promise<Response>((resolve, reject) => {
        releases.push(resolve);
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Read aborted", "AbortError")), { once: true });
    })) as typeof fetch;
    try {
        const old = new AbortController(), current = new AbortController();
        const first = apiFetch("/api/v1/staff/42", { signal: old.signal });
        const second = apiFetch("/api/v1/staff/42", { signal: current.signal });
        assert.equal(releases.length, 2);
        old.abort();
        await assert.rejects(first, { name: "AbortError" });
        releases[1](jsonResponse({ id: 42, name: "Current selection" }));
        assert.deepEqual(await (await second).json(), { id: 42, name: "Current selection" });
        assert.equal(current.signal.aborted, false);
    } finally { restoreBrowser(); }
});

test("extractErrorMessage supports FastAPI string detail", async () => {
    const message = await extractErrorMessage(
        jsonResponse({ detail: "Forbidden" }, { status: 403 }),
        "Default",
    );

    assert.equal(message, "Forbidden");
});

test("extractErrorMessage flattens FastAPI validation details", async () => {
    const message = await extractErrorMessage(
        jsonResponse({
            detail: [
                { loc: ["body", "email"], msg: "Invalid email" },
                { loc: ["body", "password"], msg: "Too short" },
            ],
        }, { status: 422 }),
        "Default",
    );

    assert.equal(message, "email: Invalid email, password: Too short");
});

test("extractErrorMessage reads object message and raw text fallback", async () => {
    assert.equal(
        await extractErrorMessage(
            jsonResponse({ detail: { message: "Nested error" } }, { status: 400 }),
            "Default",
        ),
        "Nested error",
    );
    assert.equal(
        await extractErrorMessage(new Response("Plain error", { status: 500 }), "Default"),
        "Plain error",
    );
});

test("assertApiResponseOk keeps server internals out of 5xx errors", async () => {
    const internalDiagnostic = "INTERNAL_DATABASE_DIAGNOSTIC_SHOULD_NOT_LEAK";
    await assert.rejects(
        assertApiResponseOk(
            jsonResponse(
                { detail: internalDiagnostic },
                { status: 500 },
            ),
            "No se pudieron cargar los datos",
        ),
        (error: unknown) => {
            assert.ok(error instanceof Error);
            assert.equal(error.message, "No se pudieron cargar los datos");
            assert.doesNotMatch(error.message, new RegExp(internalDiagnostic));
            return true;
        },
    );
});

test("assertApiResponseOk preserves safe actionable 4xx details", async () => {
    await assert.rejects(
        assertApiResponseOk(
            jsonResponse({ detail: "Not enough permissions" }, { status: 403 }),
            "No se pudieron cargar los datos",
        ),
        /Not enough permissions/,
    );
});

test("assertApiResponseOk preserves structured business error codes", async () => {
    await assert.rejects(
        assertApiResponseOk(
            jsonResponse(
                {
                    detail: {
                        code: "USER_HAS_RELATED_DATA",
                        message: "Safe business message",
                    },
                },
                { status: 409 },
            ),
            "Default",
        ),
        (error: unknown) => {
            assert.ok(error instanceof ApiResponseError);
            assert.equal(error.status, 409);
            assert.equal(error.code, "USER_HAS_RELATED_DATA");
            assert.equal(error.message, "Safe business message");
            return true;
        },
    );
});

test("resolveApiMediaUrl preserves local and API media urls", () => {
    assert.equal(resolveApiMediaUrl(null), null);
    assert.equal(resolveApiMediaUrl("blob:abc"), "blob:abc");
    assert.equal(resolveApiMediaUrl("/uploads/logo.png?v=1"), "/uploads/logo.png?v=1");
    assert.equal(
        resolveApiMediaUrl("https://api.workhive.test/uploads/logo.png?v=1"),
        "/uploads/logo.png?v=1",
    );
    assert.equal(
        resolveApiMediaUrl("https://cdn.workhive.test/logo.png"),
        "https://cdn.workhive.test/logo.png",
    );
});

test("apiFetch attaches JSON defaults and cookie csrf for mutations", async () => {
    installBrowser();
    (globalThis.document as { cookie: string }).cookie = "csrf_token=cookie-token";
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init: init || {} });
        return jsonResponse({ ok: true });
    };

    const response = await apiFetch("/api/v1/tasks", {
        method: "POST",
        body: JSON.stringify({ title: "Clean" }),
    });

    assert.equal(response.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/v1/tasks");
    const headers = calls[0].init.headers as Headers;
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("x-csrf-token"), "cookie-token");
    assert.equal(calls[0].init.credentials, "include");
    assert.equal(hasActiveMutations(), false);
    restoreBrowser();
});

test("apiFetch shares identical GET requests within one known actor and company and returns readable clones", async () => {
    const browser = installBrowser();
    browser.sessionStorage.setItem("workhive_user_cache:v1", JSON.stringify({ id: 2, company_id: 1, role: { name: "viewer" } }));
    let calls = 0;
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
        release = resolve;
    });
    globalThis.fetch = async () => {
        calls += 1;
        return pending;
    };

    const first = apiFetch("/api/v1/task-items/?user_id=2");
    const second = apiFetch("/api/v1/task-items/?user_id=2");
    assert.equal(calls, 1);

    release(jsonResponse([{ id: 1 }]));
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    assert.deepEqual(await firstResponse.json(), [{ id: 1 }]);
    assert.deepEqual(await secondResponse.json(), [{ id: 1 }]);
    assert.equal(calls, 1);
    restoreBrowser();
});

test("apiFetch refreshes csrf once when backend rejects stale token", async () => {
    installBrowser();
    const calls: Array<{ url: string; csrfToken: string | null }> = [];
    const responses = [
        jsonResponse({ csrf_token: "old-token" }),
        jsonResponse({ detail: "Invalid or missing CSRF token" }, { status: 403 }),
        jsonResponse({ csrf_token: "fresh-token" }),
        jsonResponse({ ok: true }),
    ];
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const headers = init?.headers as Headers | undefined;
        calls.push({ url: String(url), csrfToken: headers?.get("x-csrf-token") ?? null });
        return responses.shift() || jsonResponse({}, { status: 500 });
    };

    const response = await apiFetch("/api/v1/tasks/1", { method: "PATCH", body: "{}" });

    assert.equal(response.ok, true);
    assert.deepEqual(calls.map(call => call.url), [
        "/api/v1/auth/csrf",
        "/api/v1/tasks/1",
        "/api/v1/auth/csrf",
        "/api/v1/tasks/1",
    ]);
    assert.equal(calls[1].csrfToken, "old-token");
    assert.equal(calls[3].csrfToken, "fresh-token");
    assert.equal(hasActiveMutations(), false);
    restoreBrowser();
});

test("invitation acceptance is CSRF-exempt before a session exists", async () => {
    installBrowser("/accept-invitation");
    const calls: string[] = [];
    globalThis.fetch = async (url: string | URL | Request) => {
        calls.push(String(url));
        return jsonResponse({ status: "accepted" });
    };

    const response = await apiFetch("/api/v1/user-invitations/accept", {
        method: "POST",
        body: "{}",
    });

    assert.equal(response.ok, true);
    assert.deepEqual(calls, ["/api/v1/user-invitations/accept"]);
    restoreBrowser();
});

test("apiFetch redirects dashboard users on authentication denial but keeps valid sessions on subscription denial", async () => {
    const first = installBrowser("/dashboard/tasks");
    first.localStorage.setItem("token", "legacy-token");
    first.sessionStorage.setItem("workhive_user_cache", "{}");
    globalThis.fetch = async () => jsonResponse({}, { status: 401 });

    await apiFetch("/api/v1/tasks", { method: "GET" });

    assert.deepEqual(first.replaceCalls, ["/login?next=%2Fdashboard%2Ftasks"]);
    assert.equal(first.localStorage.getItem("token"), null);
    assert.equal(first.sessionStorage.getItem("workhive_user_cache"), null);

    const second = installBrowser("/dashboard/invoices");
    second.localStorage.setItem("token", "active-session-token");
    second.sessionStorage.setItem("workhive_user_cache", "{}");
    globalThis.fetch = async () => jsonResponse({
        detail: "The company subscription payment is past due",
    }, { status: 402 });

    await apiFetch("/api/v1/invoices", { method: "GET" });

    assert.deepEqual(second.replaceCalls, []);
    assert.equal(second.localStorage.getItem("token"), "active-session-token");
    assert.equal(second.sessionStorage.getItem("workhive_user_cache"), "{}");
    restoreBrowser();
});
