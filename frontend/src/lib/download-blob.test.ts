import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { downloadBlob } from "./download-blob.ts";

function browser(t: TestContext, fail = false) {
    const events: string[] = [];
    let release: (() => void) | undefined;
    const link = { href: "", download: "", click: () => { events.push("click"); if (fail) throw new Error("download failed"); }, remove: () => events.push("remove") };
    const original = Object.getOwnPropertyDescriptor(globalThis, "document");
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => link, body: { appendChild: () => events.push("append") } } });
    t.after(() => { if (original) Object.defineProperty(globalThis, "document", original); else Reflect.deleteProperty(globalThis, "document"); });
    t.mock.method(URL, "createObjectURL", () => "blob:private-test");
    t.mock.method(URL, "revokeObjectURL", (url: string) => events.push("revoke:" + url));
    t.mock.method(globalThis, "setTimeout", ((callback: () => void, delay: number) => { assert.equal(delay, 1000); release = callback; return 0; }) as unknown as typeof setTimeout);
    return { events, link, release: () => { assert.ok(release); release(); } };
}

test("private download starts while its blob is alive and then releases URL and anchor", t => {
    const view = browser(t);
    downloadBlob(new Blob(["private pdf"]), "parte.pdf");
    assert.equal(view.link.download, "parte.pdf");
    assert.equal(view.link.href, "blob:private-test");
    assert.deepEqual(view.events, ["append", "click", "remove"]);
    view.release();
    assert.equal(view.events.at(-1), "revoke:blob:private-test");
});
test("a failed click still removes the private download anchor and schedules release", t => {
    const view = browser(t, true);
    assert.throws(() => downloadBlob(new Blob(["private pdf"]), "parte.pdf"), /download failed/);
    assert.deepEqual(view.events, ["append", "click", "remove"]);
    view.release();
    assert.equal(view.events.at(-1), "revoke:blob:private-test");
});
