"use client"

import * as React from "react"
import {
    ArrowRight,
    Building2,
    Check,
    Home,
    MapPin,
    Sparkles,
    Trees,
    Users,
    Wrench,
    X,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/lib/toast"
import { CompanyService } from "@/services/company.service"
import { LocationService } from "@/services/location.service"
import { User } from "@/types/user"
import { useDictionary } from "@/lib/dictionary-context"

interface OnboardingModalProps {
    user: User
    onComplete: () => void
}

const fieldClass =
    "h-11 rounded-xl border-[var(--border-color)] bg-[var(--bg-tertiary)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"

export function OnboardingModal({ user, onComplete }: OnboardingModalProps) {
    const { dict } = useDictionary()
    const [step, setStep] = React.useState<"location" | "ready">("location")
    const [loading, setLoading] = React.useState(false)
    const [locationType, setLocationType] = React.useState("work_site")
    const [locationName, setLocationName] = React.useState("")
    const [locationAddress, setLocationAddress] = React.useState("")
    const [locationCity, setLocationCity] = React.useState("")
    const [locationPostalCode, setLocationPostalCode] = React.useState("")

    const onboardingKey = `workhive_onboarding_done_${user.id}`

    const closeOnboarding = React.useCallback(() => {
        localStorage.setItem(onboardingKey, "true")
        localStorage.removeItem(`workhive_onboarding_forced_${user.id}`)
        window.dispatchEvent(new Event("workhive_onboarding_completed"))
        onComplete()
    }, [onComplete, onboardingKey, user.id])

    const finishOnboarding = async () => {
        if (user.company_id) {
            await CompanyService.updateCompany(user.company_id, {
                onboarding_completed: true,
            }).catch(() => {})
        }
        closeOnboarding()
    }

    const createFirstLocation = async () => {
        if (!locationName.trim() || !locationAddress.trim() || !locationCity.trim() || !locationPostalCode.trim()) {
            toast.error(dict.onboarding.select_client_first || "Completa los datos del primer lugar de trabajo")
            return
        }

        setLoading(true)
        try {
            await LocationService.createLocation({
                name: locationName.trim(),
                address: locationAddress.trim(),
                city: locationCity.trim(),
                postal_code: locationPostalCode.trim(),
                client_id: null,
                location_type: locationType,
            })
            toast.success(dict.onboarding.location_created || "Primer lugar de trabajo creado")
            setStep("ready")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo crear la ubicación")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6">
            <div className="relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)] shadow-2xl sm:max-h-[calc(100vh-3rem)]">
                <button
                    type="button"
                    onClick={closeOnboarding}
                    aria-label="Cerrar onboarding"
                    className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-main)] shadow-sm transition-colors hover:bg-[var(--bg-secondary)]"
                >
                    <X className="h-5 w-5" />
                </button>

                <aside className="hidden w-64 shrink-0 border-r border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-7 md:block">
                    <p className="text-xs font-black uppercase text-accent">{dict.onboarding.step_of || "Primeros pasos"}</p>
                    <h2 className="mt-2 text-xl font-black text-[var(--text-main)]">{dict.onboarding.modal_title}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
                        {dict.onboarding.modal_desc}
                    </p>
                    <ol className="mt-10 space-y-6">
                        {[
                            { label: dict.onboarding.modal_step1, icon: MapPin, active: step === "location" },
                            { label: dict.onboarding.modal_step2, icon: Sparkles, active: step === "ready" },
                        ].map((item, index) => {
                            const Icon = item.icon
                            const complete = step === "ready" && index === 0
                            return (
                                <li key={item.label} className="flex items-center gap-3">
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                                        item.active
                                            ? "border-accent bg-accent text-white"
                                            : "border-accent/20 bg-accent/10 text-accent"
                                    }`}>
                                        {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--text-main)]">{item.label}</p>
                                        <p className="text-xs text-[var(--text-muted)]">{dict.onboarding.step_of || "Paso"} {index + 1}</p>
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="border-b border-[var(--border-soft)] px-5 pb-5 pt-6 pr-16 sm:px-8 sm:pb-6 sm:pt-8">
                        <div className="mb-4 flex gap-1.5 md:hidden">
                            <span className="h-1.5 flex-1 rounded-full bg-accent" />
                            <span className={`h-1.5 flex-1 rounded-full ${step === "ready" ? "bg-accent" : "bg-[var(--border-soft)]"}`} />
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                                {step === "location" ? <MapPin className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-[var(--text-main)]">
                                    {step === "location" ? (dict.onboarding.step2_title || "Tu primer lugar de trabajo") : (dict.onboarding.modal_ready_title || "Cuenta preparada")}
                                </h2>
                                <p className="mt-1 text-sm text-[var(--text-muted)]">
                                    {step === "location"
                                        ? (dict.onboarding.step2_subtitle || "Define el primer sitio donde tu equipo prestará un servicio.")
                                        : (dict.onboarding.modal_ready_desc || "Ya puedes planificar trabajos y añadir a tu equipo.")}
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
                        {step === "location" ? (
                            <div className="space-y-6">
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-accent" />
                                        <div>
                                            <h3 className="text-sm font-black text-[var(--text-main)]">{dict.onboarding.modal_question}</h3>
                                            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                                {dict.onboarding.modal_question_desc}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-1 sm:grid-cols-2">
                                        {([
                                            {
                                                id: "residential",
                                                label: dict.onboarding.modal_type_residential,
                                                description: dict.onboarding.modal_type_residential_desc,
                                                icon: Home,
                                            },
                                            {
                                                id: "business",
                                                label: dict.onboarding.modal_type_business,
                                                description: dict.onboarding.modal_type_business_desc,
                                                icon: Building2,
                                            },
                                            {
                                                id: "outdoor",
                                                label: dict.onboarding.modal_type_outdoor,
                                                description: dict.onboarding.modal_type_outdoor_desc,
                                                icon: Trees,
                                            },
                                            {
                                                id: "work_site",
                                                label: dict.onboarding.modal_type_work_site,
                                                description: dict.onboarding.modal_type_work_site_desc,
                                                icon: Wrench,
                                            },
                                        ] as const).map((option) => {
                                            const Icon = option.icon
                                            const active = locationType === option.id
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => setLocationType(option.id)}
                                                    className={`flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                                                        active
                                                            ? "bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-sm"
                                                            : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                                                    }`}
                                                >
                                                    <Icon className="h-5 w-5 shrink-0" />
                                                    <span className="min-w-0">
                                                        <span className="block text-sm font-bold">{option.label}</span>
                                                        <span className={`mt-0.5 block text-xs ${
                                                            active ? "text-current opacity-75" : "text-[var(--text-muted)]"
                                                        }`}>
                                                            {option.description}
                                                        </span>
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>

                                <section className="space-y-4 border-t border-[var(--border-soft)] pt-5">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-accent" />
                                        <h3 className="text-sm font-black text-[var(--text-main)]">{dict.onboarding.modal_data_title}</h3>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label={dict.onboarding.modal_data_name} value={locationName} onChange={setLocationName} placeholder="Piscina comunitaria, Taller Norte, Casa Anastasia..." wide />
                                        <Field label={dict.onboarding.modal_data_address} value={locationAddress} onChange={setLocationAddress} placeholder="Calle, número y piso" wide />
                                        <Field label={dict.onboarding.modal_data_city} value={locationCity} onChange={setLocationCity} placeholder="L'Escala" />
                                        <Field label={dict.onboarding.modal_data_postal} value={locationPostalCode} onChange={setLocationPostalCode} placeholder="17130" />
                                    </div>
                                </section>
                            </div>
                        ) : (
                            <div className="flex min-h-[320px] flex-col justify-center">
                                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
                                    <Sparkles className="h-7 w-7" />
                                </div>
                                <h3 className="text-2xl font-black text-[var(--text-main)]">{dict.onboarding.modal_ready_title}</h3>
                                <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
                                    {dict.onboarding.modal_ready_desc}
                                </p>
                                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                                    {[{ icon: MapPin, label: dict.dashboard.locations || "Ubicaciones" }, { icon: Users, label: dict.users.title || "Equipo" }, { icon: Check, label: dict.dashboard.tasks || "Tareas" }].map((item) => (
                                        <div key={item.label} className="flex items-center gap-2 border-t border-[var(--border-soft)] pt-3">
                                            <item.icon className="h-4 w-4 text-accent" />
                                            <span className="text-sm font-semibold text-[var(--text-main)]">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <footer className="flex items-center justify-between gap-3 border-t border-[var(--border-soft)] bg-[var(--bg-card)] px-5 py-4 sm:px-8">
                        {step === "location" ? (
                            <>
                                <button type="button" onClick={() => setStep("ready")} className="h-10 rounded-xl px-4 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)]">
                                    {dict.onboarding.modal_btn_later}
                                </button>
                                <button type="button" onClick={createFirstLocation} disabled={loading} className="flex h-10 items-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] px-5 text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-60">
                                    {loading ? (dict.locations.form.saving || "Saving...") : dict.onboarding.modal_btn_create}
                                    <ArrowRight className="h-4 w-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <span />
                                <button type="button" onClick={finishOnboarding} className="flex h-10 items-center gap-2 rounded-xl bg-[var(--btn-primary-bg)] px-5 text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)]">
                                    {dict.onboarding.modal_btn_enter}
                                    <Sparkles className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </footer>
                </div>
            </div>
        </div>
    )
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    wide = false,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder: string
    type?: string
    wide?: boolean
}) {
    return (
        <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
            <Label className="text-xs font-bold uppercase text-[var(--text-muted)]">{label}</Label>
            <Input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className={fieldClass}
            />
        </div>
    )
}
