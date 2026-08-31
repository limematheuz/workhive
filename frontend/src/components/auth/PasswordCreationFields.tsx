"use client";

import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";

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
                <Field orientation="horizontal" className="items-start gap-3 rounded-xl bg-[var(--bg-secondary)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                    <Checkbox id={`${idPrefix}-legal`} checked={acceptLegal} onCheckedChange={(checked) => onAcceptLegalChange?.(checked === true)} />
                    <FieldLabel htmlFor={`${idPrefix}-legal`} className="cursor-pointer font-normal leading-6">
                        {text.legal} <Link className="text-accent underline underline-offset-2" href="/terms" target="_blank">{text.terms}</Link>{" · "}<Link className="text-accent underline underline-offset-2" href="/privacy" target="_blank">{text.privacy}</Link>
                    </FieldLabel>
                </Field>
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
        <Field className="gap-2">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <InputGroup className="h-11">
                <InputGroupAddon align="inline-start">
                    <KeyRound aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                    id={id}
                    type={visible ? "text" : "password"}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    autoComplete="new-password"
                    required
                />
                <InputGroupAddon align="inline-end">
                    <InputGroupButton
                        type="button"
                        size="icon-sm"
                        aria-label={visible ? hideLabel : showLabel}
                        aria-pressed={visible}
                        onClick={() => onVisibilityChange(!visible)}
                    >
                        {visible ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                </InputGroupAddon>
            </InputGroup>
        </Field>
    );
}
