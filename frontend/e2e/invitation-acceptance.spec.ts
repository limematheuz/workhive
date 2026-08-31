import { expect, test } from "@playwright/test";

const workerToken = "worker-invitation-token-0123456789abcdef";
const companyToken = "company-invitation-token-0123456789abcdef";
const password = "StrongPass1!";

test("worker invitation preserves a fragment token after URL cleanup and submits it", async ({ page }) => {
    let submittedPayload: Record<string, unknown> | null = null;
    await page.route("**/api/v1/user-invitations/accept", async (route) => {
        submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ status: "accepted" }),
        });
    });

    await page.goto(`/accept-invitation#token=${workerToken}`);

    await expect(page.locator("#worker-invitation-password")).toBeVisible();
    await expect(page).toHaveURL(/\/accept-invitation$/);

    await page.locator('input[inputmode="numeric"]').fill("12345678");
    await page.locator("#worker-invitation-password").fill(password);
    await page.locator("#worker-invitation-confirm-password").fill(password);
    await page.locator("#worker-invitation-legal").click();
    await page.getByRole("button", { name: /crear mi acceso|create my access/i }).click();

    await expect(page.getByRole("heading", { name: /acceso activado|access activated/i })).toBeVisible();
    expect(submittedPayload).toEqual({
        token: workerToken,
        code: "12345678",
        password,
        accept_terms: true,
        accept_privacy: true,
        marketing_consent: false,
    });
});

test("worker invitation retains supported legacy query links before removing them from the address bar", async ({ page }) => {
    await page.goto(`/accept-invitation?token=${workerToken}`);

    await expect(page.locator("#worker-invitation-password")).toBeVisible();
    await expect(page).toHaveURL(/\/accept-invitation$/);
});

test("worker invitation reports an incomplete link without attempting acceptance", async ({ page }) => {
    let acceptanceRequests = 0;
    await page.route("**/api/v1/user-invitations/accept", async (route) => {
        acceptanceRequests += 1;
        await route.abort();
    });

    await page.goto("/accept-invitation");

    await expect(page.getByText(/el enlace de invitación no es válido|this invitation link is invalid/i)).toBeVisible();
    await expect(page.locator("#worker-invitation-password")).toHaveCount(0);
    expect(acceptanceRequests).toBe(0);
});

test("company invitation retains a fragment token while it determines the recipient state", async ({ page }) => {
    let activationPayload: Record<string, unknown> | null = null;
    await page.route("**/api/v1/collaborations/invitations/activation-status", async (route) => {
        activationPayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ mode: "requires_subscription" }),
        });
    });

    await page.goto(`/accept-company-invitation#token=${companyToken}`);

    await expect(page.getByRole("heading", { name: /empresa invitada necesita una suscripción|invited company needs a subscription/i })).toBeVisible();
    await expect(page).toHaveURL(/\/accept-company-invitation$/);
    expect(activationPayload).toEqual({ token: companyToken });
});
