import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isPublicSiteHost } from "./public-site.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("public landing explains WorkHive and optional Google Calendar access", () => {
    const landing = read("../components/marketing/PublicLanding.tsx");
    const route = read("../app/page.tsx");

    assert.match(landing, /WORKHIVE · GESTIÓN PARA EMPRESAS DE SERVICIOS/);
    assert.match(landing, /Integración opcional con Google Calendar/);
    assert.match(landing, /consentimiento explícito/);
    assert.match(landing, /no vende datos de Google/);
    assert.match(landing, /https:\/\/app\.workhive\.es\/login/);
    assert.match(route, /isPublicSiteHost\(host\)/);
    assert.match(route, /return <PublicLanding \/>/);
});

test("public pages expose stable canonical URLs for OAuth verification", () => {
    const sitemap = read("../app/sitemap.ts");
    const contactMetadata = read("../app/contact/layout.tsx");
    const privacyMetadata = read("../app/privacy/layout.tsx");
    const termsMetadata = read("../app/terms/layout.tsx");

    assert.match(sitemap, /\["", "\/privacy", "\/terms", "\/contact"\]/);
    assert.match(sitemap, /url: `https:\/\/workhive\.es\$\{path\}`/);
    assert.match(contactMetadata, /canonical: "https:\/\/workhive\.es\/contact"/);
    assert.match(privacyMetadata, /canonical: "https:\/\/workhive\.es\/privacy"/);
    assert.match(termsMetadata, /canonical: "https:\/\/workhive\.es\/terms"/);
});

test("privacy page discloses Google data use and user controls", () => {
    const privacy = read("../app/privacy/page.tsx");

    assert.doesNotMatch(privacy, /Borrador pre-lanzamiento|Pre-launch draft|privacy@workhive\.com/);
    assert.match(privacy, /Datos de Google Calendar/);
    assert.match(privacy, /tokens de acceso se almacenan cifrados/);
    assert.match(privacy, /desconectar Google Calendar/);
    assert.match(privacy, /cloud-admin@workhive\.es/);
});

test("edge config keeps marketing pages separate from the application API", () => {
    const caddy = read("../../../Caddyfile");
    const compose = read("../../../docker-compose.yml");
    const deployEnvironment = read("../../../.env.deploy.example");

    assert.match(caddy, /\{\$MARKETING_DOMAIN\}/);
    assert.doesNotMatch(caddy, /rewrite \* \/about/);
    assert.match(caddy, /\{\$APP_DOMAIN\}[\s\S]*handle \/api\/\*/);
    assert.doesNotMatch(caddy.split("{$MARKETING_DOMAIN} {")[1], /reverse_proxy backend/);
    assert.match(compose, /MARKETING_DOMAIN: \$\{MARKETING_DOMAIN:-workhive\.localhost\}/);
    assert.match(deployEnvironment, /MARKETING_DOMAIN=example\.com/);
});

test("public marketing pages do not call the application traffic API", () => {
    const tracker = read("../components/traffic/TrafficTracker.tsx");

    assert.match(tracker, /PUBLIC_SITE_PATHS/);
    for (const path of ["/", "/about", "/contact", "/privacy", "/terms"]) {
        assert.match(tracker, new RegExp(`PUBLIC_SITE_PATHS = new Set\\(\\[[^\\]]*"${path}"`));
    }
    assert.match(tracker, /PUBLIC_SITE_PATHS\.has\(pathname\)/);
});

test("public root is selected by the configured marketing hostname", () => {
    const publicSite = read("./public-site.ts");
    const compose = read("../../../docker-compose.yml");

    assert.match(publicSite, /process\.env\.MARKETING_DOMAIN \?\? "localhost"/);
    assert.match(publicSite, /hostname === domain \|\| hostname === `www\.\$\{domain\}`/);
    assert.match(compose, /MARKETING_DOMAIN: \$\{MARKETING_DOMAIN:-workhive\.localhost\}/);
    assert.equal(isPublicSiteHost("workhive.es", "workhive.es"), true);
    assert.equal(isPublicSiteHost("www.workhive.es:443", "workhive.es"), true);
    assert.equal(isPublicSiteHost("app.workhive.es", "workhive.es"), false);
});
