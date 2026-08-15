import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import path from "node:path";

import { SEMVER_PATTERN } from "./release-version.mjs";

const execFile = promisify(execFileCallback);

function assertSemanticVersion(version) {
    if (!SEMVER_PATTERN.test(version)) {
        throw new Error("VERSION must use MAJOR.MINOR.PATCH.");
    }
}

async function runGit(root, args, execute) {
    const { stdout } = await execute("git", args, { cwd: root });
    return stdout.trim();
}

async function remoteTagExists(root, tag, execute) {
    try {
        await runGit(root, ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`], execute);
        return true;
    } catch (error) {
        if (error.code === 2) return false;
        throw error;
    }
}

export async function createReleaseTag(root, { execute = execFile, readVersion = readFile } = {}) {
    const version = (await readVersion(path.join(root, "VERSION"), "utf8")).trim();
    assertSemanticVersion(version);

    const [branch, changes] = await Promise.all([
        runGit(root, ["branch", "--show-current"], execute),
        runGit(root, ["status", "--porcelain"], execute),
    ]);
    if (branch !== "main") throw new Error("Release tags can only be created from main.");
    if (changes) throw new Error("Commit or stash local changes before creating a release tag.");

    await runGit(root, ["fetch", "origin", "main", "--tags"], execute);
    const [localHead, remoteHead] = await Promise.all([
        runGit(root, ["rev-parse", "HEAD"], execute),
        runGit(root, ["rev-parse", "origin/main"], execute),
    ]);
    if (localHead !== remoteHead) {
        throw new Error("main is not synchronized with origin/main. Run git pull --ff-only origin main first.");
    }

    const tag = `v${version}`;
    if (await remoteTagExists(root, tag, execute)) {
        throw new Error(`${tag} already exists on origin; release tags are immutable.`);
    }

    await runGit(root, ["tag", "-a", tag, "-m", `Release WorkHive ${version}`], execute);
    await runGit(root, ["push", "origin", `refs/tags/${tag}`], execute);

    if (!(await remoteTagExists(root, tag, execute))) {
        throw new Error(`${tag} was not found on origin after push.`);
    }

    return { tag, version, gitSha: localHead };
}

async function main() {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const { tag, version, gitSha } = await createReleaseTag(root);
    console.log(`Created and pushed ${tag} for WorkHive ${version} (${gitSha.slice(0, 12)}).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(`Release tagging failed: ${error.message}`);
        process.exitCode = 1;
    });
}
