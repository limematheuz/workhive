import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { cleanCaches } from "./clean-caches.mjs";

const scriptPath = resolve(import.meta.dirname, "clean-caches.mjs");

test("cache cleanup has an explicit safe allowlist", async () => {
  const source = await readFile(scriptPath, "utf8");

  assert.match(source, /const cachePaths = \[/);
  assert.match(source, /frontend\/.next\/cache/);
  assert.doesNotMatch(source, /node_modules/);
  assert.doesNotMatch(source, /\.venv/);
  assert.doesNotMatch(source, /\.env/);
  assert.match(source, /Refusing to clean outside the repository/);
});

test("cache cleanup removes only allowlisted generated files", async (t) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "workhive-cache-test-"));
  t.after(() => rm(temporaryRoot, { force: true, recursive: true }));

  const cacheFile = join(temporaryRoot, "frontend/.next/cache/build.bin");
  const bytecodeFile = join(temporaryRoot, "backend/app/services/__pycache__/service.cpython-312.pyc");
  const environmentFile = join(temporaryRoot, ".env");
  await mkdir(resolve(cacheFile, ".."), { recursive: true });
  await mkdir(resolve(bytecodeFile, ".."), { recursive: true });
  await writeFile(cacheFile, "cache");
  await writeFile(bytecodeFile, "cache");
  await writeFile(environmentFile, "keep");

  await cleanCaches(temporaryRoot);

  assert.equal(existsSync(cacheFile), false);
  assert.equal(existsSync(bytecodeFile), false);
  assert.equal(existsSync(environmentFile), true);
});
