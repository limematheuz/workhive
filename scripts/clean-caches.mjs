import { existsSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

const defaultRepositoryRoot = resolve(import.meta.dirname, "..");
export const cachePaths = [
  ".pytest_cache",
  ".pnpm-store",
  "backend/.coverage",
  "backend/.pytest_cache",
  "backend/.ruff_cache",
  "frontend/.next/cache",
  "frontend/playwright-report",
  "frontend/test-results",
  "frontend/tsconfig.tsbuildinfo",
];
const pythonBytecodeRoots = ["backend/alembic", "backend/app", "backend/tests"];

async function removePythonBytecodeCaches(directory) {
  if (!existsSync(directory)) {
    return;
  }

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = resolve(directory, entry.name);
    if (entry.name === "__pycache__") {
      await rm(entryPath, { force: true, recursive: true });
      console.log(`Removed ${entryPath}`);
      continue;
    }

    await removePythonBytecodeCaches(entryPath);
  }
}

export async function cleanCaches(repositoryRoot = defaultRepositoryRoot) {
  const absoluteRepositoryRoot = resolve(repositoryRoot);

  for (const relativePath of cachePaths) {
    const targetPath = resolve(absoluteRepositoryRoot, relativePath);
    if (!targetPath.startsWith(`${absoluteRepositoryRoot}${sep}`)) {
      throw new Error(`Refusing to clean outside the repository: ${relativePath}`);
    }
    if (!existsSync(targetPath)) {
      continue;
    }

    await rm(targetPath, { force: true, recursive: true });
    console.log(`Removed ${relativePath}`);
  }

  for (const relativePath of pythonBytecodeRoots) {
    await removePythonBytecodeCaches(resolve(absoluteRepositoryRoot, relativePath));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await cleanCaches();
}
