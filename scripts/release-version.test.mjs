import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareRelease, verifyReleaseMetadata } from "./release-version.mjs";

const VERSION = "1.3.1";

async function writeFixture(root) {
    const files = {
        VERSION: `${VERSION}\n`,
        ".env.example": `APP_VERSION=${VERSION}\n`,
        ".env.deploy.example": `APP_VERSION=${VERSION}\n`,
        "docker-compose.yml": `backend: \${APP_VERSION:-${VERSION}}\nfrontend: \${APP_VERSION:-${VERSION}}\n`,
        "backend/.env.example": `APP_VERSION=${VERSION}\n`,
        "backend/Dockerfile": `ARG APP_VERSION=${VERSION}\n`,
        "backend/app/core/config.py": `    APP_VERSION: str = "${VERSION}"\n`,
        "frontend/.env.example": `NEXT_PUBLIC_APP_VERSION=${VERSION}\n`,
        "frontend/Dockerfile": `ARG NEXT_PUBLIC_APP_VERSION="${VERSION}"\n`,
        "frontend/package.json": JSON.stringify({ name: "frontend", version: VERSION }),
    };

    for (const [relativePath, content] of Object.entries(files)) {
        const target = path.join(root, relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
    }
}

async function fixtureRoot() {
    const root = await mkdtemp(path.join(os.tmpdir(), "workhive-release-version-"));
    await writeFixture(root);
    return root;
}

test("prepareRelease updates every release metadata source", async () => {
    const root = await fixtureRoot();
    const changedPaths = await prepareRelease(root, "1.3.2");

    assert.equal(changedPaths.length, 10);
    assert.equal((await readFile(path.join(root, "VERSION"), "utf8")).trim(), "1.3.2");
    assert.equal(
        JSON.parse(await readFile(path.join(root, "frontend/package.json"), "utf8")).version,
        "1.3.2",
    );
    await verifyReleaseMetadata(root, "1.3.2");
});

test("prepareRelease rejects an invalid semantic version without changing files", async () => {
    const root = await fixtureRoot();

    await assert.rejects(() => prepareRelease(root, "v1.3.2"), /MAJOR\.MINOR\.PATCH/);
    assert.equal((await readFile(path.join(root, "VERSION"), "utf8")).trim(), VERSION);
});

test("verifyReleaseMetadata detects a drifted release source", async () => {
    const root = await fixtureRoot();
    await writeFile(path.join(root, "backend/Dockerfile"), "ARG APP_VERSION=9.9.9\n", "utf8");

    await assert.rejects(() => verifyReleaseMetadata(root, VERSION), /backend\/Dockerfile/);
});
