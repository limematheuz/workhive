import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

const textTargets = [
    { path: ".env.example", pattern: /^APP_VERSION=.*$/m, replacement: (version) => `APP_VERSION=${version}` },
    { path: ".env.deploy.example", pattern: /^APP_VERSION=.*$/m, replacement: (version) => `APP_VERSION=${version}` },
    { path: "docker-compose.yml", pattern: /\$\{APP_VERSION:-[^}]+\}/g, expectedMatches: 2, replacement: (version) => `\${APP_VERSION:-${version}}` },
    { path: "backend/.env.example", pattern: /^APP_VERSION=.*$/m, replacement: (version) => `APP_VERSION=${version}` },
    { path: "backend/Dockerfile", pattern: /^ARG APP_VERSION=.*$/m, replacement: (version) => `ARG APP_VERSION=${version}` },
    { path: "backend/app/core/config.py", pattern: /^    APP_VERSION: str = ".*"$/m, replacement: (version) => `    APP_VERSION: str = "${version}"` },
    { path: "frontend/.env.example", pattern: /^NEXT_PUBLIC_APP_VERSION=.*$/m, replacement: (version) => `NEXT_PUBLIC_APP_VERSION=${version}` },
    { path: "frontend/Dockerfile", pattern: /^ARG NEXT_PUBLIC_APP_VERSION=".*"$/m, replacement: (version) => `ARG NEXT_PUBLIC_APP_VERSION="${version}"` },
];

const packageTarget = "frontend/package.json";

function assertSemanticVersion(version) {
    if (!SEMVER_PATTERN.test(version)) {
        throw new Error("Version must use MAJOR.MINOR.PATCH, for example 1.3.2.");
    }
}

function findMatches(content, pattern) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    return [...content.matchAll(new RegExp(pattern.source, flags))];
}

function replaceTarget(content, target, version) {
    const matches = findMatches(content, target.pattern);
    const expectedMatches = target.expectedMatches ?? 1;
    if (matches.length !== expectedMatches) {
        throw new Error(`${target.path} must contain exactly ${expectedMatches} release version value(s).`);
    }
    return content.replace(target.pattern, target.replacement(version));
}

async function readTarget(root, relativePath) {
    return readFile(path.join(root, relativePath), "utf8");
}

async function writeTarget(root, relativePath, content) {
    await writeFile(path.join(root, relativePath), content, "utf8");
}

export async function prepareRelease(root, version) {
    assertSemanticVersion(version);
    const changedPaths = [];

    const currentVersion = (await readTarget(root, "VERSION")).trim();
    if (currentVersion !== version) {
        await writeTarget(root, "VERSION", `${version}\n`);
        changedPaths.push("VERSION");
    }

    for (const target of textTargets) {
        const currentContent = await readTarget(root, target.path);
        const nextContent = replaceTarget(currentContent, target, version);
        if (nextContent !== currentContent) {
            await writeTarget(root, target.path, nextContent);
            changedPaths.push(target.path);
        }
    }

    const packageContent = await readTarget(root, packageTarget);
    const packageJson = JSON.parse(packageContent);
    if (packageJson.version !== version) {
        packageJson.version = version;
        await writeTarget(root, packageTarget, `${JSON.stringify(packageJson, null, 2)}\n`);
        changedPaths.push(packageTarget);
    }

    await verifyReleaseMetadata(root, version);
    return changedPaths;
}

export async function verifyReleaseMetadata(root, expectedVersion) {
    assertSemanticVersion(expectedVersion);
    const actualVersion = (await readTarget(root, "VERSION")).trim();
    if (actualVersion !== expectedVersion) {
        throw new Error(`VERSION is ${actualVersion}; expected ${expectedVersion}.`);
    }

    for (const target of textTargets) {
        const content = await readTarget(root, target.path);
        const matches = findMatches(content, target.pattern);
        const expectedMatches = target.expectedMatches ?? 1;
        if (matches.length !== expectedMatches || matches.some((match) => !match[0].includes(expectedVersion))) {
            throw new Error(`${target.path} does not match VERSION=${expectedVersion}.`);
        }
    }

    const packageJson = JSON.parse(await readTarget(root, packageTarget));
    if (packageJson.version !== expectedVersion) {
        throw new Error(`${packageTarget} does not match VERSION=${expectedVersion}.`);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

    if (args[0] === "--verify" && args.length === 1) {
        const version = (await readTarget(root, "VERSION")).trim();
        await verifyReleaseMetadata(root, version);
        console.log(`Release metadata is aligned at ${version}.`);
        return;
    }

    if (args.length !== 1) {
        throw new Error("Usage: pnpm release:prepare MAJOR.MINOR.PATCH");
    }

    const changedPaths = await prepareRelease(root, args[0]);
    console.log(`Release metadata prepared for ${args[0]}.`);
    console.log(changedPaths.length ? `Updated: ${changedPaths.join(", ")}` : "No files needed updating.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(`Release preparation failed: ${error.message}`);
        process.exitCode = 1;
    });
}
