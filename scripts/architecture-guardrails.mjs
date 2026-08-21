import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_SERVICE_LINE_LIMIT = 350;
const DEFAULT_ROUTE_LINE_LIMIT = 250;
const DEFAULT_FRONTEND_SERVICE_LINE_LIMIT = 250;

// These modules predate this guard. Their budget is frozen at the current
// size: a change must reduce them or extract a focused responsibility first.
const LEGACY_LINE_LIMITS = {
    "backend/app/services/calendar_governance_service.py": 443,
    "backend/app/services/calendar_sync_service.py": 709,
    "backend/app/services/company_service.py": 504,
    "backend/app/services/invoice_fiscal.py": 561,
    "backend/app/services/invoice_pdf.py": 535,
    "backend/app/services/invoice_service.py": 707,
    "backend/app/services/privacy_service.py": 399,
    "backend/app/services/quote_pdf.py": 386,
    "backend/app/services/quote_service.py": 437,
    "backend/app/services/reservation_service.py": 451,
    "backend/app/services/reservation_tasks.py": 384,
    "backend/app/services/task_assignment_service.py": 356,
    "backend/app/services/task_billing_service.py": 360,
    "backend/app/services/task_item_service.py": 839,
    "backend/app/services/task_report_service.py": 458,
    "backend/app/services/work_session_service.py": 348,
    "backend/app/api/v1/auth.py": 261,
    "backend/app/api/v1/invoice.py": 505,
    "backend/app/api/v1/task_items.py": 266,
    "frontend/src/services/invoice.service.ts": 383,
};

// Existing direct route persistence is explicit technical debt. New calls, or
// new route files with direct persistence, fail the check. Remove an entry
// when its route is moved behind a service/repository boundary.
const ROUTE_PERSISTENCE_DEBT = {
    "backend/app/api/v1/auth.py": ["db.add(", "db.commit("],
    "backend/app/api/v1/billing.py": ["db.query(", "db.query("],
    "backend/app/api/v1/users.py": ["db.add(", "db.commit("],
};

function sourceLines(filePath) {
    const source = readFileSync(filePath, "utf8");
    return source.split("\n").length - Number(source.endsWith("\n"));
}

function filesRecursively(directory, extension) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return filesRecursively(path, extension);
        return entry.isFile() && path.endsWith(extension) ? [path] : [];
    });
}

function assertLineBudgets(directory, extension, defaultLimit, label) {
    const violations = filesRecursively(resolve(repositoryRoot, directory), extension)
        .filter((filePath) => !filePath.endsWith(`__init__${extension}`))
        .flatMap((filePath) => {
            const repositoryPath = relative(repositoryRoot, filePath);
            const limit = LEGACY_LINE_LIMITS[repositoryPath] ?? defaultLimit;
            const lineCount = sourceLines(filePath);
            return lineCount > limit
                ? [`${repositoryPath}: ${lineCount} lines exceeds its ${limit}-line ${label} budget`]
                : [];
        });
    if (violations.length) throw new Error(violations.join("\n"));
}

function directPersistenceCalls(source) {
    return source.match(/\bdb\.(?:query|execute|add|delete|commit|flush)\(/g) ?? [];
}

function assertRoutePersistenceBoundary() {
    const routeDirectory = resolve(repositoryRoot, "backend/app/api/v1");
    const violations = filesRecursively(routeDirectory, ".py").flatMap((filePath) => {
        const repositoryPath = relative(repositoryRoot, filePath);
        const actual = directPersistenceCalls(readFileSync(filePath, "utf8"));
        const expected = ROUTE_PERSISTENCE_DEBT[repositoryPath] ?? [];
        return actual.length === expected.length
            && actual.every((call, index) => call === expected[index])
            ? []
            : [
                `${repositoryPath}: direct persistence must move to a repository/service `
                + `(expected ${expected.length} grandfathered calls, found ${actual.length})`,
            ];
    });
    if (violations.length) throw new Error(violations.join("\n"));
}

function assertFrontendServiceBoundary() {
    const frontendSource = resolve(repositoryRoot, "frontend/src");
    const allowedDirectories = [
        resolve(frontendSource, "services"),
        resolve(frontendSource, "app/api"),
    ];
    const allowedFiles = new Set([resolve(frontendSource, "lib/api.ts")]);
    const violations = filesRecursively(frontendSource, ".ts")
        .concat(filesRecursively(frontendSource, ".tsx"))
        .filter((filePath) => !filePath.endsWith(".test.ts"))
        .filter((filePath) => !allowedFiles.has(filePath))
        .filter((filePath) => !allowedDirectories.some((directory) => filePath.startsWith(`${directory}/`)))
        .filter((filePath) => /\b(?:apiFetch|fetch)\(/.test(readFileSync(filePath, "utf8")))
        .map((filePath) => `${relative(repositoryRoot, filePath)}: call the API through frontend/src/services`);
    if (violations.length) throw new Error(violations.join("\n"));
}

function assertRuntimeVersionContract() {
    const nodeVersion = readFileSync(resolve(repositoryRoot, ".nvmrc"), "utf8").trim();
    if (nodeVersion !== "22") {
        throw new Error(`.nvmrc must stay on the supported Node 22 line, found ${nodeVersion || "empty"}`);
    }
}

export function runArchitectureGuardrails() {
    assertRuntimeVersionContract();
    assertLineBudgets("backend/app/services", ".py", DEFAULT_SERVICE_LINE_LIMIT, "service");
    assertLineBudgets("backend/app/api/v1", ".py", DEFAULT_ROUTE_LINE_LIMIT, "route");
    assertLineBudgets("frontend/src/services", ".ts", DEFAULT_FRONTEND_SERVICE_LINE_LIMIT, "frontend service");
    assertRoutePersistenceBoundary();
    assertFrontendServiceBoundary();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    runArchitectureGuardrails();
    console.log("Architecture guardrails passed.");
}
