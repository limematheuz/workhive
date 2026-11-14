import { expect, test } from "@playwright/test";

test("invoice detail modal stays within mobile 390px viewport in view and edit mode", async ({ context, page }) => {
    test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
    await page.setViewportSize({ width: 390, height: 844 });
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
    await context.addCookies([{ name: "auth_token", value: `fixture.${payload}.not-a-backend-token`, url: "http://localhost:3000" }]);
    await page.addInitScript(() => localStorage.setItem("locale", "es"));

    const draft = {
        id: 18,
        invoice_number: "DRAFT-319BB417CB12",
        client_id: 187,
        company_id: 11,
        status: "draft",
        issue_date: "2026-11-14T00:00:00Z",
        due_date: "2026-11-29T00:00:00Z",
        total_amount: 54.45,
        base_amount: 45,
        tax_amount: 9.45,
        discount: 0,
        retention: 0,
        equivalence_surcharge: 0,
        is_rectification: false,
        fiscal_submission_status: "not_configured",
        payment_method: "bank_transfer",
        items: [
            { id: 1, description: "Servicio QA Facturable 20261114 / QA Ubicación Contrato 20261114 / 14/11/2026", quantity: 1, unit_price: 45, tax_rate: 0.21, subtotal: 45, total: 54.45 },
        ],
    };

    await page.route("**/api/v1/**", async (route) => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
        let body: unknown = [];
        if (path === "/api/v1/users/me") body = { id: 46, full_name: "QA Admin", role: { name: "admin" }, company_id: 11, is_active: true, can_view_finance: true, can_manage_finance: true };
        else if (path === "/api/v1/companies/11") body = { id: 11, name: "QA Co", tax_id: "B12345674", address: "Calle QA 1", onboarding_completed: true, subscription_status: "active" };
        else if (path === "/api/v1/invoices") body = [draft];
        else if (path === "/api/v1/invoices/18") body = draft;
        else if (path === "/api/v1/sales-ledger") body = [{ source_type: "invoice", source_id: 18, document_number: "INV-2026-0001", entry_date: "2026-11-14", client_name: "QA Cliente Presupuestos 20261114", base_amount: 45, tax_amount: 9.45, total_amount: 54.45, payment_status: "pending", invoice_status: "issued", is_rectification: false, collected_amount: 0, is_editable: false }];
        else if (path.includes("/fiscal/") || path.includes("/facturae/")) body = null;
        else if (path === "/api/v1/clients") body = [{ id: 187, name: "QA Cliente Presupuestos 20261114" }];
        else if (path === "/api/v1/clients/187") body = { id: 187, name: "QA Cliente Presupuestos 20261114", legal_number: "B99911114", address: "Calle QA 14" };
        else if (path.includes("alert-count")) body = { pending_requests: 0, pending_tasks: 0, unread_reports: 0 };
        await route.fulfill({ json: body });
    });

    await page.goto("/dashboard/invoice-summary");
    await expect(page.getByText("INV-2026-0001").first()).toBeVisible();
    const ledgerMetrics = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(ledgerMetrics.scrollWidth, `Ledger overflow: ${JSON.stringify(ledgerMetrics)}`).toBeLessThanOrEqual(ledgerMetrics.innerWidth);

    await page.goto("/dashboard/invoices");
    await page.getByRole("button", { name: /DRAFT-319BB417CB12/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Servicio QA Facturable 20261114")).toBeVisible();

    const measure = () => page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        const dlgRect = dlg ? dlg.getBoundingClientRect() : null;
        return {
            innerWidth: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            dialogWidth: dlgRect ? Math.round(dlgRect.width) : 0,
            dialogLeft: dlgRect ? Math.round(dlgRect.left) : 0,
            dialogRight: dlgRect ? Math.round(dlgRect.right) : 0,
        };
    });

    const viewMetrics = await measure();
    expect(viewMetrics.scrollWidth, `View mode overflow: ${JSON.stringify(viewMetrics)}`).toBeLessThanOrEqual(viewMetrics.innerWidth);
    expect(viewMetrics.dialogWidth, `View dialog too wide: ${JSON.stringify(viewMetrics)}`).toBeLessThanOrEqual(viewMetrics.innerWidth);

    await page.goto("/dashboard/invoices/18?edit=true");
    await expect(page.locator("#invoice-edit-final-number")).toBeVisible();
    const editMetrics = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(editMetrics.scrollWidth, `Edit page overflow: ${JSON.stringify(editMetrics)}`).toBeLessThanOrEqual(editMetrics.innerWidth);
});
