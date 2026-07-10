import assert from "node:assert/strict";
import test from "node:test";
import { getTrustedExternalUrl } from "./external-navigation.ts";

test("trusted Stripe redirects are accepted", () => {
    assert.equal(
        getTrustedExternalUrl("https://checkout.stripe.com/c/pay/test"),
        "https://checkout.stripe.com/c/pay/test"
    );
});

test("untrusted and insecure redirects are rejected", () => {
    assert.throws(() => getTrustedExternalUrl("https://example.com/checkout"));
    assert.throws(() => getTrustedExternalUrl("http://checkout.stripe.com/test"));
});
