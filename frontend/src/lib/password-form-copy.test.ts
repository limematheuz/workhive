import assert from "node:assert/strict";
import test from "node:test";
import { passwordFormCopy } from "./password-form-copy.ts";

test("platform invitations use activation copy and recovery links keep reset copy", () => {
    assert.equal(passwordFormCopy("whi_sample", "es").submit, "Crear contraseña");
    assert.equal(passwordFormCopy("whi_sample", "en").success, "Account activated");
    assert.equal(passwordFormCopy("sample", "es").submit, "Restablecer contraseña");
    assert.equal(passwordFormCopy("", "en").submit, "Reset Password");
});
