import assert from "node:assert/strict";
import test from "node:test";

import {
    getPasswordChecks,
    getPasswordStrength,
    isStrongPassword,
} from "./password-strength.ts";

test("password checks cover length case number and special character", () => {
    const checks = getPasswordChecks("StrongPass1!");
    assert.equal(checks.length, 5);
    assert.equal(checks.every((check) => check.valid), true);

    const weakChecks = getPasswordChecks("weak");
    assert.deepEqual(
        weakChecks.map((check) => check.valid),
        [false, true, false, false, false],
    );
});

test("password strength labels are localized and scored", () => {
    assert.deepEqual(
        {
            score: getPasswordStrength("weak", "en").score,
            label: getPasswordStrength("weak", "en").label,
        },
        { score: 1, label: "Weak" },
    );
    assert.deepEqual(
        {
            score: getPasswordStrength("Medium1", "es").score,
            label: getPasswordStrength("Medium1", "es").label,
        },
        { score: 3, label: "Media" },
    );
    assert.deepEqual(
        {
            score: getPasswordStrength("StrongPass1!", "es").score,
            label: getPasswordStrength("StrongPass1!", "es").label,
        },
        { score: 5, label: "Alta" },
    );
});

test("strong password requires every security check", () => {
    assert.equal(isStrongPassword("StrongPass1!"), true);
    assert.equal(isStrongPassword("StrongPass1"), false);
});
