import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const image = readFileSync(new URL("./image.ts", import.meta.url), "utf8");
const uploadService = readFileSync(new URL("../services/upload.service.ts", import.meta.url), "utf8");
const qualityService = readFileSync(new URL("../services/quality.service.ts", import.meta.url), "utf8");
const userService = readFileSync(new URL("../services/user.service.ts", import.meta.url), "utf8");
const locationDocumentService = readFileSync(new URL("../services/location-document.service.ts", import.meta.url), "utf8");
const profileForm = readFileSync(new URL("../components/profile/ProfileDetailsForm.tsx", import.meta.url), "utf8");

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
