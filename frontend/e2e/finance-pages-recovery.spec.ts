import { expect, test, type Page } from "@playwright/test";

function makeToken() {
    const payload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    return `fixture.${payload}.not-a-backend-token`;
}

async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
}

async function setupAuthAndLocale(page: Page, locale: "es" | "en" = "es") {
    await page.context().addCookies([
        { name: "auth_token", value: makeToken(), url: "http://localhost:3000" },
    ]);
    await page.addInitScript((value) => {
        localStorage.setItem("locale", value);
    }, locale);
}

async function switchLocaleDesktop(page: Page, targetLocale: "en" | "es") {
    const size = page.viewportSize() ?? { width: 1440, height: 900 };
    if (size.width < 1024) {
        await page.setViewportSize({ width: 1440, height: 900 });
    }
    const label = targetLocale === "en" ? "Cambiar idioma a inglés" : "Cambiar idioma a español";
    await page.getByRole("button", { name: label, exact: true }).click();
    if (size.width < 1024) {
        await page.setViewportSize(size);
    }
}

for (const width of [1440, 768, 390]) {
    test(`expenses page recovers from 503, isolates months, translates alerts live, and clears on 403 at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await setupAuthAndLocale(page, "es");

        const currentYear = new Date().getFullYear();
        const currentMonthDate = new Date(currentYear, new Date().getMonth(), 1);
        const currentMonth = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, "0")}`;
        const previousMonthDate = new Date(currentYear, new Date().getMonth() - 1, 1);
        const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}`;
        const previousMonthInput = `01/${String(previousMonthDate.getMonth() + 1).padStart(2, "0")}/${previousMonthDate.getFullYear()}`;
        const currentMonthEndCutoff = new Date(Date.UTC(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)).toISOString().slice(0, 7);

        let expenseCalls = 0;
        let currentMode: "503" | "ok" | "403" = "503";
        let previousMonthMode: "503" | "ok" | "403" = "503";

        const currentExpense = {
            id: 101,
            expense_date: `${currentMonth}-14`,
            description: "QA Gasto Actual",
            vendor: "Proveedor Actual",
            category: "supplies",
            base_amount: 100,
            tax_amount: 21,
            total_amount: 121,
            notes: "Nota actual",
            is_active: true,
        };
        const previousExpense = {
            id: 102,
            expense_date: `${previousMonth}-10`,
            description: "QA Gasto Mes Anterior",
            vendor: "Proveedor Anterior",
            category: "services",
            base_amount: 200,
            tax_amount: 42,
            total_amount: 242,
            notes: "Nota anterior",
            is_active: true,
        };

        await page.route("**/api/v1/**", async (route) => {
            const url = new URL(route.request().url());
            const path = url.pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 11,
                        full_name: "Admin QA",
                        role: { name: "admin" },
                        company_id: 1,
                        is_active: true,
                        can_view_finance: true,
                        can_manage_finance: true,
                    },
                });
            }
            if (path === "/api/v1/companies/1") {
                return route.fulfill({
                    json: { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/expenses") {
                expenseCalls += 1;
                const dateTo = url.searchParams.get("date_to") || "";
                const isPreviousQuery = !dateTo.startsWith(currentMonthEndCutoff);
                const mode = isPreviousQuery ? previousMonthMode : currentMode;
                if (mode === "503") return route.fulfill({ status: 503, json: { detail: "Service temporarily unavailable" } });
                if (mode === "403") return route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
                return route.fulfill({ json: isPreviousQuery ? [previousExpense] : [currentExpense, previousExpense] });
            }
            if (path.includes("alert-count")) return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/expenses");
        const main = page.locator("main");
        const alert = main.getByRole("alert");

        // Initial 503 must show alert + Retry and never fake empty text or 0,00 € cards
        await expect(alert).toBeVisible();
        await expect(alert).toContainText("No se pudieron cargar los gastos.");
        await expect(alert.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
        await expect(main.getByText("Todavía no hay gastos registrados.")).toHaveCount(0);
        await expect(main.getByText("0,00 €")).toHaveCount(0);
        await expectNoHorizontalOverflow(page);

        // Live ES <-> EN translation must update copy without firing extra GETs
        const callsBeforeLocale = expenseCalls;
        await switchLocaleDesktop(page, "en");
        await expect(alert).toContainText("Could not load expenses.");
        await expect(alert.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
        await switchLocaleDesktop(page, "es");
        await expect(alert).toContainText("No se pudieron cargar los gastos.");
        expect(expenseCalls).toBe(callsBeforeLocale);

        // Retry recovers current month's real data
        currentMode = "ok";
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("QA Gasto Actual").filter({ visible: true }).first()).toBeVisible();
        await expect(main.getByText("121,00 €").filter({ visible: true }).first()).toBeVisible();
        await expect(alert).toHaveCount(0);

        // Same-context transient 503 preserves current valid snapshot while showing alert + Retry
        currentMode = "503";
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["dashboard"] }));
        });
        await expect(alert).toContainText("No se pudieron cargar los gastos.");
        await expect(alert.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
        await expect(main.getByText("QA Gasto Actual").filter({ visible: true }).first()).toBeVisible();

        // Changing month when backend returns 503 clears previous month snapshot and avoids false empty/0 €
        previousMonthMode = "503";
        const monthInput = page.getByRole("textbox", { name: "Mes", exact: true });
        await monthInput.fill(previousMonthInput);
        await expect(main.getByText("QA Gasto Actual")).toHaveCount(0);
        await expect(main.getByText("Todavía no hay gastos registrados.")).toHaveCount(0);
        await expect(main.getByText("0,00 €")).toHaveCount(0);
        await expect(alert).toContainText("No se pudieron cargar los gastos.");
        await expect(alert.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();

        // Retrying new month loads previous month's real expense
        previousMonthMode = "ok";
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("QA Gasto Mes Anterior").filter({ visible: true }).first()).toBeVisible();
        await expect(main.getByText("242,00 €").filter({ visible: true }).first()).toBeVisible();

        // 403 revocation immediately withdraws snapshot and shows denial alert without Retry button
        previousMonthMode = "403";
        currentMode = "403";
        await page.evaluate(() => {
            window.dispatchEvent(new CustomEvent("workhive:realtime-invalidation", { detail: ["dashboard"] }));
        });
        await expect(main.getByText("QA Gasto Mes Anterior")).toHaveCount(0);
        await expect(main.getByText("0,00 €")).toHaveCount(0);
        await expect(alert).toBeVisible();
        await expect(alert.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);
    });

    test(`labor costs page recovers from 503, skips members for read-only users, and clears on 403 at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await setupAuthAndLocale(page, "es");

        let ratesMode: "503" | "ok" | "403" = "503";
        let laborCalls = 0;
        let membersCalls = 0;

        await page.route("**/api/v1/**", async (route) => {
            const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 21,
                        full_name: "Auditor Laboral",
                        role: { name: "viewer" },
                        company_id: 1,
                        is_active: true,
                        can_view_finance: false,
                        can_manage_finance: false,
                        can_view_labor_costs: true,
                        can_manage_labor_costs: false,
                    },
                });
            }
            if (path === "/api/v1/companies/1") {
                return route.fulfill({
                    json: { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/organization/members") {
                membersCalls += 1;
                return route.fulfill({ status: 403, json: { detail: "Not enough permissions" } });
            }
            if (path === "/api/v1/labor-costs/rates") {
                laborCalls += 1;
                if (ratesMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (ratesMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        {
                            id: 3,
                            company_membership_id: 27,
                            member_name: "Trabajadora QA",
                            hourly_cost: "18.00",
                            effective_on: "2026-11-14",
                            created_at: "2026-11-14T10:00:00Z",
                        },
                    ],
                });
            }
            if (path === "/api/v1/labor-costs/summary") {
                if (ratesMode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (ratesMode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                return route.fulfill({
                    json: [
                        {
                            user_id: 52,
                            member_name: "Trabajadora QA",
                            session_count: 2,
                            total_cost: "36.00",
                        },
                    ],
                });
            }
            if (path.includes("alert-count")) return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/labor-costs");
        const main = page.locator("main");
        const alert = main.getByRole("alert");

        await expect(alert).toBeVisible();
        await expect(alert).toContainText("No se pudieron cargar los costes laborales.");
        await expect(alert.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
        await expect(main.getByText("0,00 €")).toHaveCount(0);
        await expect(main.getByText("Sin costes laborales")).toHaveCount(0);
        expect(membersCalls).toBe(0);
        await expectNoHorizontalOverflow(page);

        const callsBeforeLocale = laborCalls;
        await switchLocaleDesktop(page, "en");
        await expect(alert).toContainText("Could not load labor costs.");
        await expect(alert.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
        await switchLocaleDesktop(page, "es");
        await expect(alert).toContainText("No se pudieron cargar los costes laborales.");
        expect(laborCalls).toBe(callsBeforeLocale);

        // Retry with 403 must transition cleanly to denied alert without Retry button
        ratesMode = "403";
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(alert).toBeVisible();
        await expect(alert.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);
        await expect(main.getByText("0,00 €")).toHaveCount(0);

        // Reload in ok mode verifies real recovery + read-only user never calls /organization/members
        ratesMode = "ok";
        await page.reload();
        await expect(main.getByText("Trabajadora QA").filter({ visible: true }).first()).toBeVisible();
        await expect(main.getByText("18,00 €").filter({ visible: true }).first()).toBeVisible();
        await expect(main.getByText("36,00 €").filter({ visible: true }).first()).toBeVisible();
        expect(membersCalls).toBe(0);
    });

    test(`fiscal summary page escapes loading on 503, clears year snapshot on failure, and handles 403 at ${width}px`, async ({ page }) => {
        test.skip(process.env.E2E_BASE_URL !== "http://localhost:3000", "Local UI regression only");
        await page.setViewportSize({ width, height: 900 });
        await setupAuthAndLocale(page, "es");

        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;
        let currentYearMode: "503" | "ok" | "403" = "503";
        let previousYearMode: "503" | "ok" | "403" = "503";
        let fiscalCalls = 0;

        const makePeriod = (key: string, label: string, vat: number) => ({
            key,
            label,
            issued_invoice_count: vat > 0 ? 1 : 0,
            registered_expense_count: 0,
            output_base_amount: vat > 0 ? 1000 : 0,
            output_vat_amount: vat,
            equivalence_surcharge_amount: 0,
            registered_expense_base_amount: 0,
            registered_input_vat_amount: 0,
            estimated_vat_balance: vat,
            withheld_irpf_amount: 0,
        });

        await page.route("**/api/v1/**", async (route) => {
            const url = new URL(route.request().url());
            const path = url.pathname.replace(/\/$/, "");
            if (path === "/api/v1/users/me") {
                return route.fulfill({
                    json: {
                        id: 31,
                        full_name: "Admin QA",
                        role: { name: "admin" },
                        company_id: 1,
                        is_active: true,
                        can_view_finance: true,
                        can_manage_finance: true,
                    },
                });
            }
            if (path === "/api/v1/companies/1") {
                return route.fulfill({
                    json: { id: 1, name: "Empresa QA", onboarding_completed: true, subscription_status: "active" },
                });
            }
            if (path === "/api/v1/fiscal-summary") {
                const year = Number(url.searchParams.get("year"));
                const isPrev = year === previousYear;
                fiscalCalls += 1;
                const mode = isPrev ? previousYearMode : currentYearMode;
                if (mode === "503") return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
                if (mode === "403") return route.fulfill({ status: 403, json: { detail: "Forbidden" } });
                const vat = isPrev ? 420 : 210;
                const periods = [1, 2, 3, 4].map((q) => makePeriod(`Q${q}`, `T${q}`, q === 1 ? vat : 0));
                return route.fulfill({
                    json: {
                        year,
                        periods,
                        annual: makePeriod("annual", String(year), vat),
                    },
                });
            }
            if (path.includes("alert-count")) return route.fulfill({ json: { pending_requests: 0, pending_tasks: 0, unread_reports: 0 } });
            return route.fulfill({ json: [] });
        });

        await page.goto("/dashboard/fiscal-summary");
        const main = page.locator("main");
        const alert = main.getByRole("alert");

        // Must exit loading spinner and show PageHeader + error alert + Retry
        await expect(main.getByText("Cargando resumen fiscal...")).toHaveCount(0);
        await expect(alert).toBeVisible();
        await expect(alert).toContainText("No se pudo cargar el resumen fiscal.");
        await expect(alert.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);

        const callsBeforeLocale = fiscalCalls;
        await switchLocaleDesktop(page, "en");
        await expect(alert).toContainText("Could not load fiscal summary.");
        await expect(alert.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
        await switchLocaleDesktop(page, "es");
        await expect(alert).toContainText("No se pudo cargar el resumen fiscal.");
        expect(fiscalCalls).toBe(callsBeforeLocale);

        // Retry recovers current year's data
        currentYearMode = "ok";
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("210,00 €").first()).toBeVisible();
        await expect(main.getByText("T4", { exact: true }).filter({ visible: true })).toBeVisible();
        await expect(alert).toHaveCount(0);

        // Switching to previous year on 503 must clear stale 210,00 € snapshot and show alert + Retry
        previousYearMode = "503";
        await main.getByRole("combobox", { name: "Ejercicio", exact: true }).click();
        await page.getByRole("option", { name: String(previousYear), exact: true }).click();
        await expect(main.getByText("210,00 €")).toHaveCount(0);
        await expect(main.getByText("Cargando resumen fiscal...")).toHaveCount(0);
        await expect(alert).toContainText("No se pudo cargar el resumen fiscal.");
        await expect(alert.getByRole("button", { name: "Reintentar", exact: true })).toBeVisible();

        // Retry previous year in ok mode loads 420,00 €
        previousYearMode = "ok";
        await alert.getByRole("button", { name: "Reintentar", exact: true }).click();
        await expect(main.getByText("420,00 €").first()).toBeVisible();

        // Switching back to current year with 403 withdraws snapshot and shows denial alert without Retry
        currentYearMode = "403";
        await main.getByRole("combobox", { name: "Ejercicio", exact: true }).click();
        await page.getByRole("option", { name: String(currentYear), exact: true }).click();
        await expect(main.getByText("420,00 €")).toHaveCount(0);
        await expect(alert).toBeVisible();
        await expect(alert.getByRole("button", { name: /Reintentar|Retry/i })).toHaveCount(0);
    });
}
