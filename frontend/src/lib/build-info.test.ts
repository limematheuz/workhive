import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createBuildInfo } from "./build-info.ts";


test("frontend package version matches the repository source of truth", () => {
    const releaseVersion = readFileSync(
        new URL("../../../VERSION", import.meta.url),
        "utf8",
    ).trim();
    const packageMetadata = JSON.parse(
        readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    assert.equal(packageMetadata.version, releaseVersion);
});


test("build info uses a short trusted revision", () => {
    assert.deepEqual(createBuildInfo("1.1.1", "b".repeat(40)), {
        version: "1.1.1",
        revision: "bbbbbbbbbbbb",
        label: "v1.1.1 · bbbbbbbbbbbb",
    });
});


test("build info does not expose malformed environment values", () => {
    assert.deepEqual(createBuildInfo("not-semver", "<script>alert(1)</script>"), {
        version: "0.0.0-dev",
        revision: "unknown",
        label: "v0.0.0-dev",
    });
});


test("Docker and sidebar keep version and revision metadata wired", () => {
    const compose = readFileSync(
        new URL("../../../docker-compose.yml", import.meta.url),
        "utf8",
    );
    const backendDockerfile = readFileSync(
        new URL("../../../backend/Dockerfile", import.meta.url),
        "utf8",
    );
    const frontendDockerfile = readFileSync(
        new URL("../../Dockerfile", import.meta.url),
        "utf8",
    );
    const sidebarFooter = readFileSync(
        new URL("../components/dashboard/SidebarFooterControls.tsx", import.meta.url),
        "utf8",
    );

    assert.match(compose, /APP_VERSION: \$\{APP_VERSION:-1\.2\.5\}/);
    assert.match(compose, /GIT_SHA: \$\{GIT_SHA:-unknown\}/);
    assert.match(backendDockerfile, /ARG APP_VERSION=1\.2\.5/);
    assert.match(backendDockerfile, /ARG GIT_SHA=unknown/);
    assert.match(frontendDockerfile, /ARG NEXT_PUBLIC_APP_VERSION="1\.2\.5"/);
    assert.match(frontendDockerfile, /ARG NEXT_PUBLIC_GIT_SHA="unknown"/);
    assert.match(sidebarFooter, /publicBuildInfo\.label/);
});
