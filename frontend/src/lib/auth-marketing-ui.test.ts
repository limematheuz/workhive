import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("auth marketing pages share AuthShell glass chrome", () => {
    const shell = read("../components/auth/AuthShell.tsx");
    const card = read("../components/auth/AuthGlassCard.tsx");
    const login = read("../app/(auth)/login/page.tsx");
    const register = read("../app/(auth)/register/page.tsx");
    const forgot = read("../app/(auth)/forgot-password/page.tsx");
    const subscription = read("../app/subscription/page.tsx");
    const checkout = read("../app/subscription/checkout/page.tsx");
    const contact = read("../app/contact/page.tsx");

    assert.match(shell, /dashboard-shell-backlight/);
    assert.match(shell, /showThemeToggle/);
    assert.match(card, /glass-sheet-bg/);
    assert.match(login, /AuthShell/);
    assert.match(login, /AuthGlassCard/);
    assert.match(login, /request_access/);
    assert.match(register, /AuthShell/);
    assert.match(forgot, /AuthShell/);
    assert.match(subscription, /AuthShell/);
    assert.match(checkout, /AuthShell/);
    assert.match(contact, /AuthShell/);
    assert.doesNotMatch(login, /Solicitar acceso/);
    assert.doesNotMatch(login, /bg-purple-500/);
    assert.doesNotMatch(subscription, /animate-pulse/);
});

test("auth dictionaries expose short access and pricing copy", () => {
    const es = JSON.parse(read("../dictionaries/es.json"));
    const en = JSON.parse(read("../dictionaries/en.json"));

    assert.equal(es.auth.request_access, "Solicitar acceso");
    assert.equal(en.auth.request_access, "Request access");
    assert.equal(es.auth.plan_trial_name, "Evaluación asistida");
    assert.equal(en.auth.plan_trial_name, "Assisted evaluation");
    assert.equal(es.auth.contact_support_email, "info@workhive.es");
    assert.equal(es.auth.contact_location_value, "España");
    assert.equal(en.auth.contact_location_value, "Spain");
    assert.ok(Array.isArray(es.auth.plan_pro_features));
    assert.ok(Array.isArray(en.auth.plan_pro_features));
    assert.match(es.auth.forgot_sent_body, /\{email\}/);
    assert.match(en.auth.checkout_body, /\{plan\}/);
    assert.doesNotMatch(es.auth.register_trial_title, /prueba gratuita/i);
    assert.doesNotMatch(en.auth.register_trial_title, /free trial/i);
});

test("login offers Google button chrome without wiring OAuth", () => {
    const login = read("../app/(auth)/login/page.tsx");
    assert.match(login, /google_button/);
    assert.match(login, /google_soon/);
    assert.match(login, /LoginSuccessIllustration/);
    assert.match(login, /LoginErrorIllustration/);
    assert.doesNotMatch(login, /authService\.loginWithGoogle|oauth|signInWithPopup/);
    assert.doesNotMatch(login, /bg-emerald-500|text-emerald|animate-ping/);
});

test("subscription highlights Pro without clipping the recommended badge", () => {
    const subscription = read("../app/subscription/page.tsx");
    const card = read("../components/auth/AuthGlassCard.tsx");
    const es = JSON.parse(read("../dictionaries/es.json"));
    assert.match(card, /overflow-visible/);
    assert.match(subscription, /-top-3 right-5/);
    assert.match(subscription, /planBadgeClass/);
    assert.match(subscription, /bg-accent/);
    assert.equal(es.auth.plan_pro_price, "19,99€");
});
