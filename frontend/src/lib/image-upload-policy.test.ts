import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const image = readFileSync(new URL("./image.ts", import.meta.url), "utf8");
const uploadService = readFileSync(new URL("../services/upload.service.ts", import.meta.url), "utf8");
const qualityService = readFileSync(new URL("../services/quality.service.ts", import.meta.url), "utf8");
const userService = readFileSync(new URL("../services/user.service.ts", import.meta.url), "utf8");
const locationDocumentService = readFileSync(new URL("../services/location-document.service.ts", import.meta.url), "utf8");
const profileForm = readFileSync(new URL("../components/profile/ProfileDetailsForm.tsx", import.meta.url), "utf8");
const signatureUpload = readFileSync(new URL("../components/billing/SignatureUpload.tsx", import.meta.url), "utf8");
const companyDetails = readFileSync(new URL("../components/profile/CompanyDetailsFormFields.tsx", import.meta.url), "utf8");
const qualityEvidence = readFileSync(new URL("../components/quality/QualityEvidenceSection.tsx", import.meta.url), "utf8");
const documentLibrary = readFileSync(new URL("../app/dashboard/documents/page.tsx", import.meta.url), "utf8");
const certificateDialog = readFileSync(new URL("../components/invoices/FiscalSettingsConfigureDialog.tsx", import.meta.url), "utf8");
const salesLedgerImport = readFileSync(new URL("../components/invoices/SalesLedgerImportDialog.tsx", import.meta.url), "utf8");
const locationBulkImport = readFileSync(new URL("../components/locations/LocationBulkImportDialog.tsx", import.meta.url), "utf8");

test("every photo upload uses the shared browser compressor", () => {
    assert.match(image, /export async function compressImageForUpload/);
    assert.match(image, /MAX_IMAGE_UPLOAD_BYTES = 1 \* 1024 \* 1024/);
    assert.match(image, /IMAGE_UPLOAD_TARGET_BYTES = 850 \* 1024/);
    assert.match(uploadService, /compressImageForUpload\(file\)/);
    assert.match(qualityService, /compressImageForUpload\(file\)/);
    assert.match(userService, /compressImageForUpload\(file\)/);
    assert.match(locationDocumentService, /file\.type\.startsWith\("image\/"\)/);
    assert.match(locationDocumentService, /compressImageForUpload\(file\)/);
    assert.match(profileForm, /compressImageForUpload\(file\)/);
});

test("file selection uses the shared Input component without changing upload boundaries", () => {
    for (const source of [signatureUpload, companyDetails, qualityEvidence, documentLibrary, certificateDialog, salesLedgerImport, locationBulkImport, profileForm]) {
        assert.match(source, /from "@\/components\/ui\/input"/);
        assert.match(source, /<Input[\s\S]*type="file"/);
        assert.doesNotMatch(source, /<input\b/);
    }
});
