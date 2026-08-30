"use client";

import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";

import { DocumentFormInput } from "@/components/billing/DocumentFormControls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { PasswordStrengthChecklist } from "./PasswordStrengthChecklist";

type PasswordCreationFieldsProps = {
    locale: string;
    password: string;
    confirmPassword: string;
    acceptLegal?: boolean;
    onPasswordChange: (value: string) => void;
    onConfirmPasswordChange: (value: string) => void;
    onAcceptLegalChange?: (accepted: boolean) => void;
    idPrefix: string;
    showLegal?: boolean;
};

export function PasswordCreationFields({
    locale,
    password,
    confirmPassword,
    acceptLegal,
    onPasswordChange,
    onConfirmPasswordChange,
    onAcceptLegalChange,
    idPrefix,
    showLegal = true,
}: PasswordCreationFieldsProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const text = locale === "es" ? {
        password: "Crea una contraseña",
        confirmPassword: "Confirma la contraseña",
        legal: "Acepto los términos y la política de privacidad.",
        terms: "Términos",
        privacy: "Privacidad",
        show: "Mostrar contraseña",
        hide: "Ocultar contraseña",
    } : {
        password: "Create a password",
        confirmPassword: "Confirm password",
        legal: "I accept the terms and privacy notice.",
        terms: "Terms",
        privacy: "Privacy",
        show: "Show password",
        hide: "Hide password",
    };

    return (
        <div className="space-y-4">
            <PasswordInput
                id={`${idPrefix}-password`}
                label={text.password}
                value={password}
                onChange={onPasswordChange}
                visible={showPassword}
                onVisibilityChange={setShowPassword}
                showLabel={text.show}
                hideLabel={text.hide}
            />
            <PasswordStrengthChecklist password={password} locale={locale} />
            <PasswordInput
                id={`${idPrefix}-confirm-password`}
                label={text.confirmPassword}
                value={confirmPassword}
                onChange={onConfirmPasswordChange}
                visible={showConfirmPassword}
                onVisibilityChange={setShowConfirmPassword}
                showLabel={text.show}
                hideLabel={text.hide}
            />
            {showLegal && (
                <div className="flex items-start gap-3 rounded-xl bg-[var(--bg-secondary)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                    <Checkbox id={`${idPrefix}-legal`} checked={acceptLegal} onCheckedChange={(checked) => onAcceptLegalChange?.(checked === true)} />
                    <Label htmlFor={`${idPrefix}-legal`} className="cursor-pointer font-normal leading-6">
                        {text.legal} <Link className="text-accent underline underline-offset-2" href="/terms" target="_blank">{text.terms}</Link>{" · "}<Link className="text-accent underline underline-offset-2" href="/privacy" target="_blank">{text.privacy}</Link>
                    </Label>
                </div>
            )}
        </div>
    );
}

function PasswordInput({ id, label, value, onChange, visible, onVisibilityChange, showLabel, hideLabel }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    visible: boolean;
    onVisibilityChange: (visible: boolean) => void;
    showLabel: string;
    hideLabel: string;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <DocumentFormInput id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" className="pl-10 pr-11" required />
                <Button type="button" variant="ghost" size="icon-xs" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={visible ? hideLabel : showLabel} onClick={() => onVisibilityChange(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button>
            </div>
        </div>
    );
}
