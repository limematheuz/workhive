import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "";
const day = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

async function fixture(context: BrowserContext, page: Page) {
    const now = new Date(), current = day(now), month = current.slice(0, 7);
    const previous = day(new Date(now.getFullYear(), now.getMonth() - 1, 5));
    const yesterday = day(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const future = day(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10));
    const invoices = [
        { id: 1, invoice_number: "F-ANTERIOR", client_id: 2, issue_date: `${previous}T10:00:00Z`, due_date: yesterday, total_amount: 121, collected_amount: 21, status: "partially_paid", is_rectification: false },
        { id: 2, invoice_number: "F-ACTUAL", client_id: 2, issue_date: `${month}-01T10:00:00Z`, due_date: future, total_amount: 200, collected_amount: 59, status: "partially_paid", is_rectification: false },
        { id: 3, invoice_number: "BORRADOR-QA", client_id: 2, issue_date: `${current}T10:00:00Z`, due_date: null, total_amount: 30, collected_amount: 0, status: "draft", is_rectification: false },
    ];
    const client = { id: 2, name: "Oficinas Norte", client_type: "business", company_id: 1, is_active: true, city: "Madrid" };
    const writes: string[] = [];
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: base }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));
    await page.route("**/api/v1/**", async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname.replace(/\/$/, "");
        if (path === "/api/v1/traffic/page-view") { await route.fulfill({ status: 204 }); return; }
        if (request.method() !== "GET") writes.push(`${request.method()} ${path}`);
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 1, email: "finance-reader@example.test", full_name: "Lector de finanzas", company_id: 1, is_active: true, role_id: 1, role: { id: 1, name: "admin" }, can_view_finance: true, can_manage_finance: false, can_view_work_reports: false, can_manage_work_reports: false, can_manage_work: false, can_manage_time: false, can_approve_time: false, can_view_labor_costs: false, can_manage_labor_costs: false, can_view_quality: false };
        else if (path === "/api/v1/companies/1") body = { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/companies/current/entitlements") body = { entitlements: ["features.clients", "features.invoices", "features.quotes"].map(code => ({ code, value_type: "boolean", value: true })) };
        else if (path === "/api/v1/session/companies") body = { current_company_id: 1, companies: [{ id: 1, name: "Empresa QA", access_class: "admin", disabled: false, disabled_reason: null }] };
        else if (path.endsWith("/organization/access")) body = { "finance.read": true, "finance.manage": false, "clients.read": true, "work.read": false, "time.read": false, "locations.read": false };
        else if (path === "/api/v1/clients/access") body = { can_read_clients: true, can_manage_clients: false, can_read_commercial_follow_ups: false, can_manage_commercial_follow_ups: false };
        else if (path === "/api/v1/clients") body = [client];
        else if (path === "/api/v1/invoices") body = invoices.slice(Number(url.searchParams.get("skip") ?? 0), Number(url.searchParams.get("skip") ?? 0) + Number(url.searchParams.get("limit") ?? 100));
        else if (path === "/api/v1/sales-ledger") body = invoices.filter(invoice => invoice.status !== "draft").map(invoice => ({ source_type: "invoice", source_id: invoice.id, document_number: invoice.invoice_number, entry_date: invoice.issue_date.slice(0, 10), client_name: client.name, base_amount: invoice.total_amount / 1.21, tax_amount: invoice.total_amount - invoice.total_amount / 1.21, total_amount: invoice.total_amount, collected_amount: invoice.collected_amount, payment_status: "pending", invoice_status: invoice.status, is_rectification: false, is_editable: false }));
        else if (path === "/api/v1/customer-payments") body = [
            { id: 1, client_id: 2, received_at: `${current}T09:00:00Z`, amount: "80.00", status: "received", reference: "Transferencia de este mes", allocations: [{ invoice_id: 1, amount: "21" }, { invoice_id: 2, amount: "59" }], allocated_amount: "80", unapplied_amount: "0" },
            { id: 2, client_id: 2, received_at: `${current}T09:00:00Z`, amount: "50.00", status: "voided", reference: "Cobro anulado", allocations: [], allocated_amount: "0", unapplied_amount: "0" },
        ];
        else if (path === "/api/v1/fiscal-settings") body = { quarterly_vat_enabled: true, quarterly_withholding_enabled: true, fiscal_reminder_days: 7 };
        else if (path === "/api/v1/session/applications") body = { current_application: "internal", current_key: "internal:1", applications: [{ key: "internal:1", kind: "internal", label: "Administración", description: "Empresa QA", company_id: 1, company_name: "Empresa QA", href: "/dashboard" }] };
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });
    return { writes };
}

test.beforeEach(() => test.skip(!/^http:\/\/(?:localhost|127\.0\.0\.1):(?:3000|3013)$/.test(base), "Local intercepted finance regression only"));

for (const width of [1440, 390]) test(`receipt month and current balances stay distinct at ${width}px`, async ({ context, page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await fixture(context, page);
    await page.goto("/dashboard/invoice-summary");
    const receipt = page.getByRole("button", { name: /^Cobrado:/ });
    await expect(receipt).toContainText("Ver cobrado");
    await expect(receipt).toHaveAccessibleName(/80,00/);
    await expect(page.getByRole("button", { name: /^Pendiente:/ })).toHaveAccessibleName(/241,00/);
    await expect(page.getByRole("button", { name: /^Vencido:/ })).toHaveAccessibleName(/100,00/);
    await receipt.click();
    await expect(page.getByText("Transferencia de este mes", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("Cobro anulado", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(state.writes).toEqual([]);
});

test("overdue attention includes an issued earlier-month balance and excludes future due invoices", async ({ context, page }) => {
    await fixture(context, page);
    await page.goto("/dashboard/invoices?month=&attention=overdue");
    await expect(page.getByRole("button", { name: "F-ANTERIOR", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "F-ACTUAL", exact: true })).toHaveCount(0);
    await expect(page.getByText("Con saldo vencido", { exact: false }).first()).toBeVisible();
});

test("finance readers can consult fiscal deadlines without configuration writes", async ({ context, page }) => {
    const state = await fixture(context, page);
    await page.goto("/dashboard/fiscal-calendar");
    await expect(page.getByText("Próximo vencimiento orientativo", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Guardar/ })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    expect(state.writes).toEqual([]);
});
