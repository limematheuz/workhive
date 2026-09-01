import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("auth marketing pages share AuthShell glass chrome", () => {
    const shell = read("../components/auth/AuthShell.tsx");
    const card = read("../components/auth/AuthGlassCard.tsx");
    const login = read("../app/(auth)/login/LoginPageClient.tsx");
    const register = read("../app/(auth)/register/page.tsx");
    const forgot = read("../app/(auth)/forgot-password/page.tsx");
    const subscription = read("../app/subscription/page.tsx");
    const checkout = read("../app/subscription/checkout/page.tsx");
    const contact = read("../app/contact/page.tsx");
    const contactForm = read("../components/contact/ContactFormCard.tsx");
    const contactAside = read("../components/contact/ContactInfoAside.tsx");

    assert.match(shell, /dashboard-shell-backlight/);
    assert.match(shell, /absolute inset-0 overflow-hidden/);
    assert.match(shell, /showThemeToggle/);
    assert.match(shell, /safe-area-inset/);
    // Clip backlight in the decorative layer only — not on <main> (scroll trap).
    assert.doesNotMatch(shell, /items-center overflow-x-(?:hidden|clip)/);
    assert.match(card, /glass-sheet-bg/);
    assert.match(login, /AuthShell/);
    assert.match(login, /AuthGlassCard/);
    assert.match(login, /billing-surface/);
    assert.match(login, /request_access/);
    assert.match(register, /AuthShell/);
    assert.match(register, /billing-surface/);
    assert.match(register, /billing-block/);
    assert.match(register, /contact\?reason=trial/);
    assert.match(forgot, /AuthShell/);
    assert.match(subscription, /AuthShell/);
    assert.match(checkout, /AuthShell/);
    assert.match(contact, /AuthShell/);
    assert.match(contactForm, /billing-surface/);
    assert.match(contactForm, /from "@\/components\/ui\/input"/);
    assert.match(contactForm, /from "@\/components\/ui\/label"/);
    assert.match(contactForm, /AUTH_FIELD_CLASS/);
    assert.match(contactAside, /billing-block/);
    assert.doesNotMatch(login, /Solicitar acceso/);
    assert.doesNotMatch(login, /bg-purple-500/);
    assert.doesNotMatch(subscription, /animate-pulse/);
    assert.doesNotMatch(register, /\bbg-white\b/);
    assert.doesNotMatch(contactForm, /\bbg-white\b/);
    assert.doesNotMatch(contactAside, /\bbg-white\b/);
    assert.doesNotMatch(contactAside, /glass-sheet-bg/);
});

test("auth dictionaries expose short access and pricing copy", () => {
    const es = JSON.parse(read("../dictionaries/es.json"));
    const en = JSON.parse(read("../dictionaries/en.json"));

    assert.equal(es.auth.request_access, "Solicitar acceso");
    assert.equal(en.auth.request_access, "Request access");
    assert.equal(es.auth.plan_basic_name, "Base");
    assert.equal(en.auth.plan_basic_name, "Base");
    assert.equal(es.auth.plan_enterprise_name, "Empresarial");
    assert.equal(en.auth.plan_enterprise_name, "Enterprise");
    assert.equal(es.auth.plan_custom_name, "Personalizado");
    assert.equal(en.auth.plan_custom_name, "Custom");
    assert.equal(es.auth.pricing_monthly, "Mensual");
    assert.equal(en.auth.pricing_annual, "Annual");
    assert.equal(es.auth.contact_support_email, "info@workhive.es");
    assert.equal(es.auth.contact_location_value, "España");
    assert.equal(en.auth.contact_location_value, "Spain");
    assert.ok(Array.isArray(es.auth.plan_basic_features));
    assert.ok(Array.isArray(en.auth.plan_top_features));
    assert.ok(Array.isArray(es.auth.plan_custom_features));
    assert.ok(Array.isArray(en.auth.plan_enterprise_features));
    assert.match(es.auth.pricing_subtitle, /capacidad/i);
    assert.match(en.auth.pricing_subtitle, /capacity/i);
    assert.match(es.auth.register_company_desc, /producto completo durante 14 días/i);
    assert.match(en.auth.register_company_desc, /full product access for 14 days/i);
    assert.match(es.auth.contact_trial_subtitle, /Producto completo durante 14 días/i);
    assert.match(en.auth.contact_trial_subtitle, /Full product for 14 days/i);
    assert.match(es.auth.forgot_sent_body, /\{email\}/);
    assert.match(en.auth.checkout_body, /\{plan\}/);
    assert.doesNotMatch(es.auth.register_trial_title, /prueba gratuita/i);
    assert.doesNotMatch(en.auth.register_trial_title, /free trial/i);
});

test("login offers Google button chrome without wiring OAuth", () => {
    const login = read("../app/(auth)/login/LoginPageClient.tsx");
    const feedback = read("../components/auth/LoginStatusFeedback.tsx");
    assert.match(login, /google_button/);
    assert.match(login, /google_soon/);
    assert.match(login, /LoginStatusFeedback/);
    assert.match(feedback, /LoginSuccessIllustration/);
    assert.match(feedback, /LoginErrorIllustration/);
    assert.match(feedback, /text-accent/);
    assert.doesNotMatch(login, /authService\.loginWithGoogle|oauth|signInWithPopup/);
});

test("subscription shows the canonical commercial catalogue without clipping the recommended badge", () => {
    const subscription = read("../app/subscription/page.tsx");
    const card = read("../components/auth/AuthGlassCard.tsx");
    const es = JSON.parse(read("../dictionaries/es.json"));
    assert.match(card, /overflow-visible/);
    assert.match(subscription, /-top-3 right-5/);
    assert.match(subscription, /Badge/);
    assert.match(subscription, /billing-surface/);
    assert.match(subscription, /xl:grid-cols-6/);
    assert.match(subscription, /PremiumTabs/);
    assert.match(subscription, /plan_basic_name/);
    assert.match(subscription, /plan_custom_name/);
    assert.match(subscription, /monthlyPrice: 29/);
    assert.match(subscription, /annualPrice: 290/);
    assert.match(subscription, /monthlyPrice: 249/);
    assert.match(subscription, /annualPrice: 2490/);
    assert.match(subscription, /NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED/);
    assert.match(subscription, /subscription\/checkout\?plan=/);
    assert.match(subscription, /contact\?reason=plan-base/);
    assert.match(subscription, /contact\?reason=plan-personalizado/);
    assert.match(subscription, /bg-accent/);
    assert.equal(es.auth.pricing_badge, "Precios de lanzamiento · IVA no incluido");
    assert.equal(es.auth.pricing_request_access, "Solicitar acceso");
    assert.equal(es.auth.pricing_choose_plan, "Elegir este plan");
});

test("checkout accepts canonical plans and the annual interval", () => {
    const checkout = read("../app/subscription/checkout/page.tsx");
    const billing = read("../services/billing.service.ts");
    assert.match(billing, /billing_interval/);
    assert.match(checkout, /"basic", "medium", "top", "mega"/);
    assert.match(checkout, /requestedInterval === "annual"/);
    assert.match(checkout, /plan_enterprise_name/);
});

test("register and contact stay mobile-first with tinted surfaces", () => {
    const register = read("../app/(auth)/register/page.tsx");
    const contact = read("../app/contact/page.tsx");
    const contactForm = read("../components/contact/ContactFormCard.tsx");

    assert.match(register, /flex-col gap-2\.5/);
    assert.match(register, /h-12 w-full/);
    assert.match(register, /see_plans/);
    assert.match(register, /contact_cta/);
    assert.match(contact, /order-1 lg:order-2/);
    assert.match(contact, /order-2 lg:order-1/);
    assert.match(contactForm, /h-12 w-full rounded-2xl/);
    assert.match(contactForm, /AUTH_FIELD_CLASS/);
    assert.match(read("../components/auth/auth-ui.ts"), /text-base/);
});
