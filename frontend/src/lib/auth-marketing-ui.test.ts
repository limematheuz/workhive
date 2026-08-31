import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("auth marketing pages share AuthShell glass chrome", () => {
    const shell = read("../components/auth/AuthShell.tsx");
    const card = read("../components/auth/AuthGlassCard.tsx");
    const login = read("../app/(auth)/login/LoginPageClient.tsx");
    const loginForm = read("../components/auth/LoginFormPanel.tsx");
    const loginMarketing = read("../components/auth/LoginMarketingPanel.tsx");
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
    assert.match(login, /LoginFormPanel/);
    assert.match(login, /LoginMarketingPanel/);
    assert.match(loginForm, /AuthGlassCard/);
    assert.match(loginForm, /billing-surface/);
    assert.match(loginForm, /request_access/);
    assert.match(loginMarketing, /AuthLogo/);
    assert.match(register, /AuthShell/);
    assert.match(register, /billing-surface/);
    assert.match(register, /billing-block/);
    assert.match(register, /href="\/subscription"/);
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

test("auth dictionaries expose the commercial purchase copy in both languages", () => {
    const es = JSON.parse(read("../dictionaries/es.json"));
    const en = JSON.parse(read("../dictionaries/en.json"));

    assert.equal(es.auth.request_access, "Solicitar acceso");
    assert.equal(en.auth.request_access, "Request access");
    assert.equal(es.subscription.plan_names.basic, "Base");
    assert.equal(en.subscription.plan_names.mega, "Enterprise");
    assert.equal(es.subscription.custom_title, "Plan personalizado");
    assert.equal(en.subscription.custom_title, "Custom plan");
    assert.equal(es.auth.contact_support_email, "info@workhive.es");
    assert.equal(es.auth.contact_location_value, "España");
    assert.equal(en.auth.contact_location_value, "Spain");
    assert.match(es.auth.forgot_sent_body, /\{email\}/);
    assert.match(es.subscription.checkout_intro, /Stripe/);
    assert.match(en.subscription.checkout_intro, /Stripe/);
});

test("login offers Google button chrome without wiring OAuth", () => {
    const login = read("../app/(auth)/login/LoginPageClient.tsx");
    const loginForm = read("../components/auth/LoginFormPanel.tsx");
    const feedback = read("../components/auth/LoginStatusFeedback.tsx");
    assert.match(login, /LoginFormPanel/);
    assert.match(loginForm, /google_button/);
    assert.match(loginForm, /google_soon/);
    assert.match(loginForm, /LoginStatusFeedback/);
    assert.match(feedback, /LoginSuccessIllustration/);
    assert.match(feedback, /LoginErrorIllustration/);
    assert.match(feedback, /text-accent/);
    assert.doesNotMatch(loginForm, /authService\.loginWithGoogle|oauth|signInWithPopup/);
});

test("subscription uses the versioned public catalog and guided Stripe purchase flow", () => {
    const subscription = read("../app/subscription/page.tsx");
    const checkout = read("../app/subscription/checkout/page.tsx");
    const catalog = read("../components/subscription/PlanCatalog.tsx");
    const activation = read("../app/activate-purchase/page.tsx");
    const billing = read("../services/billing.service.ts");
    assert.match(subscription, /billingService\.listPublicPlans/);
    assert.match(subscription, /PlanCatalog/);
    assert.match(catalog, /checkout_available/);
    assert.match(catalog, /PremiumTabs/);
    assert.match(catalog, /Collapsible/);
    assert.match(catalog, /items-start/);
    assert.match(catalog, /billing_interval/);
    assert.match(catalog, /prices/);
    assert.match(catalog, /plan-custom/);
    assert.match(catalog, /entitlements/);
    assert.match(checkout, /createCompanyPurchaseCheckout/);
    assert.match(checkout, /billingService\.createCheckout/);
    assert.match(checkout, /billing_interval/);
    assert.match(checkout, /from "@\/components\/ui\/checkbox"/);
    assert.match(checkout, /from "@\/components\/ui\/input"/);
    assert.match(checkout, /from "@\/components\/ui\/button"/);
    assert.match(activation, /activateCompanyPurchase/);
    assert.match(activation, /replaceState/);
    assert.doesNotMatch(billing, /"lifetime"/);
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
