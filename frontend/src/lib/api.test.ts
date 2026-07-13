import assert from "node:assert/strict";
import test from "node:test";

import {
    apiFetch,
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

test("apiFetch shares concurrent identical GET requests and returns readable clones", async () => {
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

test("apiFetch redirects dashboard users on auth and subscription denial", async () => {
    const first = installBrowser("/dashboard/tasks");
    first.localStorage.setItem("token", "legacy-token");
    first.sessionStorage.setItem("workhive_user_cache", "{}");
    globalThis.fetch = async () => jsonResponse({}, { status: 401 });

    await apiFetch("/api/v1/tasks", { method: "GET" });

    assert.deepEqual(first.replaceCalls, ["/login"]);
    assert.equal(first.localStorage.getItem("token"), null);
    assert.equal(first.sessionStorage.getItem("workhive_user_cache"), null);

    const second = installBrowser("/dashboard/invoices");
    globalThis.fetch = async () => jsonResponse({
        detail: "The company subscription payment is past due",
    }, { status: 402 });

    await apiFetch("/api/v1/invoices", { method: "GET" });

    assert.deepEqual(second.replaceCalls, ["/login"]);
    restoreBrowser();
});
