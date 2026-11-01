import { expect, test } from "@playwright/test";
import { selectSection } from "./helpers/select-section";

type Profile = { name: string; read: boolean; manage: boolean; financeRead: boolean; financeManage: boolean; revoke?: boolean };
const profiles: Profile[] = [
    { name: "worker", read: false, manage: false, financeRead: false, financeManage: false },
    { name: "finance only", read: false, manage: false, financeRead: true, financeManage: false },
    { name: "inventory reader", read: true, manage: false, financeRead: false, financeManage: false },
    { name: "inventory manager", read: true, manage: true, financeRead: false, financeManage: false },
    { name: "combined reader", read: true, manage: false, financeRead: true, financeManage: false },
    { name: "stock manager with finance read", read: true, manage: true, financeRead: true, financeManage: false },
    { name: "administrator", read: true, manage: true, financeRead: true, financeManage: true },
    { name: "revoked reader", read: true, manage: false, financeRead: true, financeManage: false, revoke: true },
];

for (const width of [1440, 390]) for (const profile of profiles) {
    test(`inventory ${profile.name} respects actions and data boundaries at ${width}px`, async ({ context, page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 1000 });
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
        await context.addCookies([{ name: "auth_token", value: `fixture.${token}.not-a-backend-token`, url: "http://localhost:3000" }]);
        await page.addInitScript(() => localStorage.setItem("locale", "es"));
        let canRead = profile.read;
        const reads: string[] = [];
        let writes = 0;
        await page.route("**/api/v1/**", async route => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path.startsWith("/api/v1/inventory/")) {
                if (route.request().method() === "GET") reads.push(path);
                else writes++;
            }
            let body: unknown = [];
            if (path === "/api/v1/users/me") body = { id: 1, full_name: "QA", role: { name: profile.financeManage ? "admin" : "viewer" }, company_id: 1, is_active: true, can_view_finance: profile.financeRead, can_manage_finance: profile.financeManage };
            else if (path === "/api/v1/companies/1") body = { id: 1, name: "QA", onboarding_completed: true, subscription_status: "active" };
            else if (path.endsWith("organization/access")) body = { "inventory.read": canRead, "inventory.manage": profile.manage, "finance.read": profile.financeRead, "finance.manage": profile.financeManage };
            else if (path === "/api/v1/inventory/purchases") body = [{ id: 1, supplier_name_snapshot: "QA proveedor", status: "received", lines: [{ id: 1 }], expense: { expense_date: "2026-11-01T12:00:00Z", description: "QA compra", total_amount: 1 } }];
            await route.fulfill({ json: body });
        });
        await page.goto("/dashboard/inventory");
        if (!profile.read) {
            await expect(page.getByRole("heading", { name: "Inventario restringido", exact: true })).toBeVisible();
            expect(reads).toEqual([]);
            await expect(page.getByRole("button", { name: /Añadir material|Añadir almacén|Añadir proveedor|Registrar movimiento|Nueva compra|Corregir/ }).filter({ visible: true })).toHaveCount(0);
        } else {
            await selectSection(page, page, "Catálogo", "Área de inventario");
            await expect(page.getByRole("button", { name: "Añadir material", exact: true }).filter({ visible: true })).toHaveCount(profile.manage ? 1 : 0);
            await selectSection(page, page, "Operativa", "Área de inventario");
            await selectSection(page, page, "Movimientos", "Vista: Operativa");
            await expect(page.getByRole("button", { name: "Registrar movimiento", exact: true }).filter({ visible: true })).toHaveCount(profile.manage ? 1 : 0);
            if (profile.financeRead) {
                await selectSection(page, page, "Compras", "Área de inventario");
                await expect(page.getByText("QA compra", { exact: false }).filter({ visible: true })).toBeVisible();
                const canWrite = profile.manage && profile.financeManage;
                await expect(page.getByRole("button", { name: "Nueva compra", exact: true }).filter({ visible: true })).toHaveCount(canWrite ? 1 : 0);
                await expect(page.getByRole("button", { name: "Corregir", exact: true }).filter({ visible: true })).toHaveCount(canWrite ? 1 : 0);
                expect(reads).toContain("/api/v1/inventory/purchases");
            } else {
                await expect(page.getByRole("tab", { name: "Compras", exact: true })).toHaveCount(0);
                expect(reads).not.toContain("/api/v1/inventory/purchases");
            }
            if (profile.revoke) {
                canRead = false;
                const before = reads.length;
                await page.reload();
                await expect(page.getByRole("heading", { name: "Inventario restringido", exact: true })).toBeVisible();
                expect(reads).toHaveLength(before);
                await expect(page.getByRole("tab", { name: "Compras", exact: true })).toHaveCount(0);
            }
        }
        expect(writes).toBe(0);
    });
}
