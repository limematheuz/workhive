import assert from "node:assert/strict";
import test from "node:test";

import {
    DEFAULT_THEME,
    applyTheme,
    readThemeFromStorage,
    resolveTheme,
} from "./theme.ts";

class MemoryStorage {
    private data = new Map<string, string>();

    getItem(key: string) {
        return this.data.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.data.set(key, value);
    }
}

function classList() {
    const classes = new Set<string>();
    return {
        classes,
        toggle: (name: string, force?: boolean) => {
            if (force) classes.add(name);
            else classes.delete(name);
        },
    };
}

test("resolveTheme accepts stored modes and falls back to system dark", () => {
    assert.equal(resolveTheme("dark"), "dark");
    assert.equal(resolveTheme("light"), "light");

    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
        value: { matchMedia: () => ({ matches: true }) },
        configurable: true,
    });

    assert.equal(resolveTheme("bad-value"), "dark");

    Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
    });
});

test("readThemeFromStorage returns default without browser storage", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
        value: undefined,
        configurable: true,
    });

    assert.equal(readThemeFromStorage(), DEFAULT_THEME);

    Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
    });
});

test("readThemeFromStorage reads localStorage when browser is available", () => {
    const originalWindow = globalThis.window;
    const originalLocalStorage = globalThis.localStorage;
    const storage = new MemoryStorage();
    storage.setItem("theme", "dark");
    Object.defineProperty(globalThis, "window", {
        value: { matchMedia: () => ({ matches: false }) },
        configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
        value: storage,
        configurable: true,
    });

    assert.equal(readThemeFromStorage(), "dark");

    Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
        value: originalLocalStorage,
        configurable: true,
    });
});

test("applyTheme toggles light-mode on html and body", () => {
    const originalDocument = globalThis.document;
    const htmlClassList = classList();
    const bodyClassList = classList();
    Object.defineProperty(globalThis, "document", {
        value: {
            documentElement: { classList: htmlClassList },
            body: { classList: bodyClassList },
        },
        configurable: true,
    });

    applyTheme("light");
    assert.equal(htmlClassList.classes.has("light-mode"), true);
    assert.equal(bodyClassList.classes.has("light-mode"), true);

    applyTheme("dark");
    assert.equal(htmlClassList.classes.has("light-mode"), false);
    assert.equal(bodyClassList.classes.has("light-mode"), false);

    Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        configurable: true,
    });
});
