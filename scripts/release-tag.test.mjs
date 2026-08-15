import assert from "node:assert/strict";
import test from "node:test";

import { createReleaseTag } from "./release-tag.mjs";

function gitFixture({ branch = "main", changes = "", localHead = "abc123", remoteHead = "abc123", remoteTag = false } = {}) {
    const calls = [];
    let tagExists = remoteTag;
    const execute = async (_command, args) => {
        calls.push(args);
        const command = args.join(" ");
        if (command === "branch --show-current") return { stdout: branch };
        if (command === "status --porcelain") return { stdout: changes };
        if (command === "rev-parse HEAD") return { stdout: localHead };
        if (command === "rev-parse origin/main") return { stdout: remoteHead };
        if (command.startsWith("ls-remote")) {
            if (tagExists) return { stdout: "abc123\trefs/tags/v1.3.2" };
            const error = new Error("not found");
            error.code = 2;
            throw error;
        }
        if (command.startsWith("push origin refs/tags/")) {
            tagExists = true;
            return { stdout: "" };
        }
        return { stdout: "" };
    };
    return { calls, execute };
}

const readVersion = async () => "1.3.2\n";

test("createReleaseTag creates and verifies an annotated tag from synchronized main", async () => {
    const { calls, execute } = gitFixture();

    const result = await createReleaseTag("/repo", { execute, readVersion });

    assert.deepEqual(result, { tag: "v1.3.2", version: "1.3.2", gitSha: "abc123" });
    assert.ok(calls.some((args) => args.join(" ") === "tag -a v1.3.2 -m Release WorkHive 1.3.2"));
    assert.ok(calls.some((args) => args.join(" ") === "push origin refs/tags/v1.3.2"));
});

test("createReleaseTag refuses a dirty working tree before fetching or tagging", async () => {
    const { calls, execute } = gitFixture({ changes: " M VERSION" });

    await assert.rejects(
        () => createReleaseTag("/repo", { execute, readVersion }),
        /Commit or stash local changes/,
    );
    assert.equal(calls.some((args) => args[0] === "fetch"), false);
});

test("createReleaseTag refuses an existing immutable remote tag", async () => {
    const { execute } = gitFixture({ remoteTag: true });

    await assert.rejects(
        () => createReleaseTag("/repo", { execute, readVersion }),
        /already exists on origin/,
    );
});
