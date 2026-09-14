import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/dashboard/quality/page.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../components/dashboard/sidebar-nav-config.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../services/quality.service.ts", import.meta.url), "utf8");
const evidenceSection = readFileSync(new URL("../components/quality/QualityEvidenceSection.tsx", import.meta.url), "utf8");
const conformitySection = readFileSync(new URL("../components/quality/QualityInspectionConformitySection.tsx", import.meta.url), "utf8");
const image = readFileSync(new URL("./image.ts", import.meta.url), "utf8");

test("quality has a protected dedicated workspace in Operations", () => {
    assert.match(page, /canViewQuality\(user\) && !isPlatformSuperadmin\(user\)/);
    assert.match(page, /QualityService\.getTemplates/);
    assert.match(page, /DataListTable/);
    assert.match(page, /PremiumTabs/);
    assert.match(page, /QualityEvidenceSection/);
    assert.match(service, /addInspectionEvidence/);
    assert.match(service, /addIncidentEvidence/);
    assert.match(service, /signInspectionConformity/);
    assert.match(service, /client_acceptance/);
    assert.match(evidenceSection, /resolveApiMediaUrl/);
    assert.match(conformitySection, /QualityService\.signInspectionConformity/);
    assert.match(conformitySection, /Aceptación del cliente registrada/);
    assert.match(service, /compressImageForUpload/);
    assert.match(image, /MAX_IMAGE_UPLOAD_BYTES = 1 \* 1024 \* 1024/);
    assert.match(image, /IMAGE_UPLOAD_TARGET_BYTES = 850 \* 1024/);
    assert.doesNotMatch(evidenceSection, /\bfetch\s*\(/);
    assert.doesNotMatch(page, /\bfetch\s*\(/);
    assert.match(sidebar, /href: "\/dashboard\/quality", label: "Calidad"/);
});
