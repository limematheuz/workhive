"use client";

import { Building2, ChevronLeft, ChevronRight, KeyRound, MailCheck, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordCreationFields } from "@/components/auth/PasswordCreationFields";
import { DocumentFormInput } from "@/components/billing/DocumentFormControls";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { WizardProgress } from "@/components/ui/wizard-progress";
import { isStrongPassword } from "@/lib/password-strength";

export type CompanyInvitationSignupData = {
    verificationCode: string;
    fullName: string;
    companyName: string;
    taxId: string;
    address: string;
    phone: string;
    password: string;
};

type CompanyInvitationSignupWizardProps = {
    locale: string;
    mode: "new-account" | "existing-no-company";
    initialFullName: string;
    submitting: boolean;
    onVerifyCode: (code: string) => Promise<string>;
    onDecline: (code: string) => Promise<void>;
    onComplete: (data: CompanyInvitationSignupData) => Promise<void>;
};

type WizardText = {
    title: string;
    description: string;
    progress: string;
    steps: [string, string, string];
    codeTitle: string;
    codeHelp: string;
    code: string;
    verifyCode: string;
    companyTitle: string;
    companyHelp: string;
    fullName: string;
    company: string;
    taxId: string;
    address: string;
    phone: string;
    accessTitle: string;
    accessHelp: string;
    email: string;
    back: string;
    continue: string;
    decline: string;
    create: string;
    required: string;
    codeRequired: string;
    passwordMismatch: string;
};

function copy(locale: string, mode: CompanyInvitationSignupWizardProps["mode"]): WizardText {
    const isNewAccount = mode === "new-account";
    if (locale === "es") {
        return {
            title: isNewAccount ? "Crea el acceso de tu empresa" : "Completa los datos de tu empresa",
            description: isNewAccount
                ? "Crea la empresa invitada en tres pasos sencillos."
                : "Tu cuenta existe, pero aún no pertenece a una empresa. Completa los tres pasos para continuar.",
            progress: "Progreso de la invitación",
            steps: ["Verificar correo", "Datos de empresa", "Acceso seguro"],
            codeTitle: "1. Verifica el código",
            codeHelp: "Introduce el código único incluido en el correo de invitación.",
            code: "Código del correo",
            verifyCode: "Verificar código",
            companyTitle: "2. Datos de la empresa",
            companyHelp: "Solo pedimos los datos mínimos para crear la empresa invitada.",
            fullName: "Tu nombre completo",
            company: "Nombre de la empresa",
            taxId: "NIF / CIF",
            address: "Dirección fiscal",
            phone: "Teléfono",
            accessTitle: "3. Acceso seguro",
            accessHelp: isNewAccount ? "Crea la contraseña del administrador de la empresa." : "Revisa el correo que representará a la empresa antes de aceptar.",
            email: "Correo de administrador",
            back: "Anterior",
            continue: "Siguiente",
            decline: "Rechazar invitación",
            create: "Crear empresa y aceptar",
            required: "Completa los campos obligatorios para continuar.",
            codeRequired: "Introduce el código de verificación del correo.",
            passwordMismatch: "Las contraseñas no coinciden o no cumplen los requisitos de seguridad.",
        };
    }

    return {
        title: isNewAccount ? "Create your company access" : "Complete your company details",
        description: isNewAccount
            ? "Create the invited company in three simple steps."
            : "Your account exists but is not connected to a company yet. Complete the three steps to continue.",
        progress: "Invitation progress",
        steps: ["Verify email", "Company details", "Secure access"],
        codeTitle: "1. Verify the code",
        codeHelp: "Enter the unique code included in the invitation email.",
        code: "Email code",
        verifyCode: "Verify code",
        companyTitle: "2. Company details",
        companyHelp: "We only ask for the minimum details needed to create the invited company.",
        fullName: "Your full name",
        company: "Company name",
        taxId: "Tax ID",
        address: "Registered address",
        phone: "Phone",
        accessTitle: "3. Secure access",
        accessHelp: isNewAccount ? "Create the administrator password for the company." : "Review the email that will represent the company before accepting.",
        email: "Administrator email",
        back: "Back",
        continue: "Next",
        decline: "Decline invitation",
        create: "Create company and accept",
        required: "Complete the required fields to continue.",
        codeRequired: "Enter the verification code from the email.",
        passwordMismatch: "Passwords do not match or do not meet the security requirements.",
    };
}

export function CompanyInvitationSignupWizard({
    locale,
    mode,
    initialFullName,
    submitting,
    onVerifyCode,
    onDecline,
    onComplete,
}: CompanyInvitationSignupWizardProps) {
    const text = copy(locale, mode);
    const [step, setStep] = useState(1);
    const [verificationCode, setVerificationCode] = useState("");
    const [verifiedEmail, setVerifiedEmail] = useState("");
    const [fullName, setFullName] = useState(initialFullName);
    const [companyName, setCompanyName] = useState("");
    const [taxId, setTaxId] = useState("");
    const [address, setAddress] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [acceptLegal, setAcceptLegal] = useState(false);
    const isNewAccount = mode === "new-account";
    const normalizedCode = verificationCode.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const companyDetailsComplete = Boolean(companyName.trim() && taxId.trim() && address.trim() && phone.trim() && (!isNewAccount || fullName.trim()));

    const verifyCode = async () => {
        if (!normalizedCode) {
            toast.error(text.codeRequired);
            return;
        }
        try {
            setVerifiedEmail(await onVerifyCode(normalizedCode));
            setStep(2);
        } catch {
            // The parent presents the server's localized invitation error.
        }
    };

    const continueFromDetails = () => {
        if (!companyDetailsComplete) {
            toast.error(text.required);
            return;
        }
        setStep(3);
    };

    const complete = async () => {
        if (isNewAccount && (!acceptLegal || password !== confirmPassword || !isStrongPassword(password))) {
            toast.error(text.passwordMismatch);
            return;
        }
        await onComplete({ verificationCode: normalizedCode, fullName, companyName, taxId, address, phone, password });
    };

    return (
        <div className="space-y-5">
            <InvitationHeader title={text.title} description={text.description} />
            <WizardProgress step={step} steps={text.steps} ariaLabel={text.progress} />
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 sm:p-5">
                {step === 1 && <CodeStep text={text} code={verificationCode} normalizedCode={normalizedCode} submitting={submitting} onCodeChange={setVerificationCode} onVerify={() => void verifyCode()} onDecline={() => void onDecline(normalizedCode)} />}
                {step === 2 && <CompanyDetailsStep text={text} isNewAccount={isNewAccount} fullName={fullName} companyName={companyName} taxId={taxId} address={address} phone={phone} submitting={submitting} onFullNameChange={setFullName} onCompanyNameChange={setCompanyName} onTaxIdChange={setTaxId} onAddressChange={setAddress} onPhoneChange={setPhone} onBack={() => setStep(1)} onContinue={continueFromDetails} />}
                {step === 3 && <AccessStep text={text} locale={locale} isNewAccount={isNewAccount} email={verifiedEmail} password={password} confirmPassword={confirmPassword} acceptLegal={acceptLegal} submitting={submitting} onPasswordChange={setPassword} onConfirmPasswordChange={setConfirmPassword} onAcceptLegalChange={setAcceptLegal} onBack={() => setStep(2)} onComplete={() => void complete()} />}
            </section>
        </div>
    );
}

function InvitationHeader({ title, description }: { title: string; description: string }) {
    return <div className="space-y-2"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><Building2 className="h-5 w-5" /></span><h1 className="text-2xl font-bold text-[var(--text-main)]">{title}</h1><p className="text-sm leading-6 text-[var(--text-muted)]">{description}</p></div>;
}

function StepHeading({ icon: Icon, title, description }: { icon: typeof Building2; title: string; description: string }) {
    return <div className="mb-5 flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Icon className="h-4 w-4" /></span><div><h2 className="font-semibold text-[var(--text-main)]">{title}</h2><p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">{description}</p></div></div>;
}

function CodeStep({ text, code, normalizedCode, submitting, onCodeChange, onVerify, onDecline }: { text: WizardText; code: string; normalizedCode: string; submitting: boolean; onCodeChange: (value: string) => void; onVerify: () => void; onDecline: () => void }) {
    return <div className="space-y-5"><StepHeading icon={MailCheck} title={text.codeTitle} description={text.codeHelp} /><div className="space-y-2"><Label htmlFor="company-invitation-code">{text.code}</Label><DocumentFormInput id="company-invitation-code" className="h-12 text-center font-mono text-lg tracking-[0.2em]" value={code} onChange={(event) => onCodeChange(event.target.value.toUpperCase())} autoComplete="one-time-code" required /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button type="button" variant="dangerSoft" disabled={submitting} onClick={onDecline}>{text.decline}</Button><Button type="button" disabled={submitting || !normalizedCode} onClick={onVerify}><ShieldCheck />{text.verifyCode}</Button></div></div>;
}

function CompanyDetailsStep({ text, isNewAccount, fullName, companyName, taxId, address, phone, submitting, onFullNameChange, onCompanyNameChange, onTaxIdChange, onAddressChange, onPhoneChange, onBack, onContinue }: { text: WizardText; isNewAccount: boolean; fullName: string; companyName: string; taxId: string; address: string; phone: string; submitting: boolean; onFullNameChange: (value: string) => void; onCompanyNameChange: (value: string) => void; onTaxIdChange: (value: string) => void; onAddressChange: (value: string) => void; onPhoneChange: (value: string) => void; onBack: () => void; onContinue: () => void }) {
    return <div className="space-y-5"><StepHeading icon={UserRound} title={text.companyTitle} description={text.companyHelp} />{isNewAccount && <FormField label={text.fullName} id="company-invitation-full-name" value={fullName} onChange={onFullNameChange} autoComplete="name" />}<div className="grid gap-4 sm:grid-cols-2"><FormField label={text.company} id="company-invitation-company" value={companyName} onChange={onCompanyNameChange} autoComplete="organization" /><FormField label={text.taxId} id="company-invitation-tax-id" value={taxId} onChange={onTaxIdChange} /></div><FormField label={text.address} id="company-invitation-address" value={address} onChange={onAddressChange} autoComplete="street-address" /><FormField label={text.phone} id="company-invitation-phone" value={phone} onChange={onPhoneChange} type="tel" autoComplete="tel" /><WizardNavigation backLabel={text.back} continueLabel={text.continue} onBack={onBack} onContinue={onContinue} disabled={submitting} /></div>;
}

function AccessStep({ text, locale, isNewAccount, email, password, confirmPassword, acceptLegal, submitting, onPasswordChange, onConfirmPasswordChange, onAcceptLegalChange, onBack, onComplete }: { text: WizardText; locale: string; isNewAccount: boolean; email: string; password: string; confirmPassword: string; acceptLegal: boolean; submitting: boolean; onPasswordChange: (value: string) => void; onConfirmPasswordChange: (value: string) => void; onAcceptLegalChange: (accepted: boolean) => void; onBack: () => void; onComplete: () => void }) {
    const canComplete = !isNewAccount || (acceptLegal && password === confirmPassword && isStrongPassword(password));
    return <div className="space-y-5"><StepHeading icon={KeyRound} title={text.accessTitle} description={text.accessHelp} /><div className="rounded-xl bg-[var(--bg-secondary)] px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{text.email}</p><p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{email}</p></div>{isNewAccount && <PasswordCreationFields locale={locale} password={password} confirmPassword={confirmPassword} acceptLegal={acceptLegal} onPasswordChange={onPasswordChange} onConfirmPasswordChange={onConfirmPasswordChange} onAcceptLegalChange={onAcceptLegalChange} idPrefix="company-invitation" />}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button type="button" variant="outline" disabled={submitting} onClick={onBack}><ChevronLeft />{text.back}</Button><Button type="button" disabled={submitting || !canComplete} onClick={onComplete}><ShieldCheck />{text.create}</Button></div></div>;
}

function FormField({ label, id, value, onChange, type = "text", autoComplete }: { label: string; id: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) {
    return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><DocumentFormInput id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required /></div>;
}

function WizardNavigation({ backLabel, continueLabel, onBack, onContinue, disabled }: { backLabel: string; continueLabel: string; onBack: () => void; onContinue: () => void; disabled: boolean }) {
    return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button type="button" variant="outline" disabled={disabled} onClick={onBack}><ChevronLeft />{backLabel}</Button><Button type="button" disabled={disabled} onClick={onContinue}>{continueLabel}<ChevronRight /></Button></div>;
}
