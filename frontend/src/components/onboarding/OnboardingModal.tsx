"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    ArrowRight,
    BriefcaseBusiness,
    Building2,
    Check,
    ClipboardCheck,
    Home,
    Hotel,
    MapPin,
    Sparkles,
    Trees,
    Users,
    X,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    OperatingModel,
    OnboardingLocationType,
    buildCompanyOnboardingInput,
    defaultLocationTypeForModel,
    isOnboardingLocationComplete,
} from "@/domain/onboarding/cleaning-onboarding"
import { useDictionary } from "@/lib/dictionary-context"
import { toast } from "@/lib/toast"
import {
    CompanyOnboardingResult,
    CompanyService,
} from "@/services/company.service"
import { User } from "@/types/user"

interface OnboardingModalProps {
    user: User
    onComplete: () => void
}

type Step = "model" | "location" | "ready"

const fieldClass =
    "h-11 rounded-lg border-[var(--border-color)] bg-[var(--bg-tertiary)] text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"

function useOnboardingModalController({ user, onComplete }: OnboardingModalProps) {
    const { dict } = useDictionary()
    const router = useRouter()
    const [step, setStep] = React.useState<Step>("model")
    const [loading, setLoading] = React.useState(false)
    const [operatingModel, setOperatingModel] = React.useState<OperatingModel>("service_provider")
    const [locationType, setLocationType] = React.useState<OnboardingLocationType>("private")
    const [locationName, setLocationName] = React.useState("")
    const [locationAddress, setLocationAddress] = React.useState("")
    const [locationCity, setLocationCity] = React.useState("")
    const [locationPostalCode, setLocationPostalCode] = React.useState("")
    const [result, setResult] = React.useState<CompanyOnboardingResult | null>(null)
    const [modelLoading, setModelLoading] = React.useState(Boolean(user.company_id))
    const selectedModelManually = React.useRef(false)

    const onboardingKey = `workhive_onboarding_done_${user.id}`

    React.useEffect(() => {
        if (!user.company_id) return
        let cancelled = false
        void CompanyService.getCompany(user.company_id)
            .then((company) => {
                if (
                    !cancelled
                    && !selectedModelManually.current
                    && (company.operating_model === "service_provider"
                        || company.operating_model === "property_manager"
                        || company.operating_model === "hybrid")
                ) {
                    setOperatingModel(company.operating_model)
                    setLocationType(defaultLocationTypeForModel(company.operating_model))
                }
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setModelLoading(false) })
        return () => { cancelled = true }
    }, [user.company_id])

    const closeOnboarding = React.useCallback((destination?: string) => {
        localStorage.setItem(onboardingKey, "true")
        localStorage.removeItem(`workhive_onboarding_forced_${user.id}`)
        window.dispatchEvent(new Event("workhive_onboarding_completed"))
        onComplete()
        if (destination) router.push(destination)
    }, [onComplete, onboardingKey, router, user.id])

    const selectOperatingModel = (model: OperatingModel) => {
        selectedModelManually.current = true
        setOperatingModel(model)
        setLocationType(defaultLocationTypeForModel(model))
    }

    const completeWithoutLocation = async () => {
        if (!user.company_id) return
        setLoading(true)
        try {
            await CompanyService.completeOnboarding(
                user.company_id,
                buildCompanyOnboardingInput(operatingModel),
            )
            closeOnboarding()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.onboarding.completion_error)
        } finally {
            setLoading(false)
        }
    }

    const createStarterSetup = async () => {
        if (!user.company_id) return

        const fields = {
            name: locationName,
            address: locationAddress,
            city: locationCity,
            postalCode: locationPostalCode,
            locationType,
        }
        if (!isOnboardingLocationComplete(fields)) {
            toast.error(dict.onboarding.location_required)
            return
        }

        setLoading(true)
        try {
            const onboardingResult = await CompanyService.completeOnboarding(
                user.company_id,
                buildCompanyOnboardingInput(operatingModel, fields),
            )
            setResult(onboardingResult)
            toast.success(onboardingResult.created ? dict.onboarding.starter_created : dict.onboarding.setup_already_ready)
            setStep("ready")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.onboarding.completion_error)
        } finally {
            setLoading(false)
        }
    }

    const modelOptions = [
        {
            id: "service_provider" as const,
            label: dict.onboarding.model_provider,
            description: dict.onboarding.model_provider_desc,
            icon: BriefcaseBusiness,
        },
        {
            id: "property_manager" as const,
            label: dict.onboarding.model_manager,
            description: dict.onboarding.model_manager_desc,
            icon: Hotel,
        },
        {
            id: "hybrid" as const,
            label: dict.onboarding.model_hybrid,
            description: dict.onboarding.model_hybrid_desc,
            icon: Building2,
        },
    ]

    const locationOptions = [
        { id: "private" as const, label: dict.onboarding.space_home, icon: Home },
        { id: "real_estate" as const, label: dict.onboarding.space_lodging, icon: Hotel },
        { id: "business" as const, label: dict.onboarding.space_business, icon: Building2 },
        { id: "exterior" as const, label: dict.onboarding.space_outdoor, icon: Trees },
        { id: "other" as const, label: dict.onboarding.space_other, icon: MapPin },
    ]

    const starterItems = operatingModel === "property_manager"
        ? dict.onboarding.checklist_manager
        : operatingModel === "hybrid"
            ? dict.onboarding.checklist_hybrid
            : dict.onboarding.checklist_provider

    const locationIntro = operatingModel === "property_manager"
        ? dict.onboarding.location_intro_manager
        : operatingModel === "hybrid"
            ? dict.onboarding.location_intro_hybrid
            : dict.onboarding.location_intro_provider

    const stepIndex = step === "model" ? 0 : step === "location" ? 1 : 2
    const steps = [
        { label: dict.onboarding.modal_step_model, icon: BriefcaseBusiness },
        { label: dict.onboarding.modal_step_location, icon: MapPin },
        { label: dict.onboarding.modal_step_ready, icon: Sparkles },
    ]

    return {
        closeOnboarding,
        completeWithoutLocation,
        createStarterSetup,
        dict,
        loading,
        modelLoading,
        locationAddress,
        locationCity,
        locationName,
        locationOptions,
        locationPostalCode,
        locationType,
        locationIntro,
        modelOptions,
        operatingModel,
        result,
        selectOperatingModel,
        setLocationAddress,
        setLocationCity,
        setLocationName,
        setLocationPostalCode,
        setLocationType,
        setStep,
        starterItems,
        step,
        stepIndex,
        steps,
    }
}

export function OnboardingModal(props: OnboardingModalProps) {
    const controller = useOnboardingModalController(props)
    return <OnboardingModalContent controller={controller} />
}

function OnboardingModalContent({
    controller,
}: {
    controller: ReturnType<typeof useOnboardingModalController>
}) {
    const {
        closeOnboarding,
        completeWithoutLocation,
        createStarterSetup,
        dict,
        loading,
        modelLoading,
        locationAddress,
        locationCity,
        locationName,
        locationOptions,
        locationPostalCode,
        locationType,
        locationIntro,
        modelOptions,
        operatingModel,
        result,
        selectOperatingModel,
        setLocationAddress,
        setLocationCity,
        setLocationName,
        setLocationPostalCode,
        setLocationType,
        setStep,
        starterItems,
        step,
        stepIndex,
        steps,
    } = controller

    return (
        <Dialog open>
            <DialogContent
                showCloseButton={false}
                overlayClassName="dialog-glass-overlay"
                onPointerDownOutside={(event) => event.preventDefault()}
                onEscapeKeyDown={(event) => event.preventDefault()}
                className="dialog-glass flex max-h-[calc(100vh-1.5rem)] w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-[28px] p-0 sm:max-h-[calc(100vh-3rem)] sm:max-w-5xl"
            >
                <button
                    type="button"
                    onClick={() => step === "ready" ? closeOnboarding() : void completeWithoutLocation()}
                    disabled={loading || modelLoading}
                    aria-label={dict.onboarding.modal_btn_later}
                    data-slot="dialog-close"
                    className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-main)] transition-colors disabled:opacity-50"
                >
                    <X className="h-5 w-5" />
                </button>

                <aside className="dialog-glass-chrome hidden w-64 shrink-0 rounded-l-[28px] border-r border-[var(--border-soft)] p-7 md:block">
                    <p className="text-xs font-black uppercase text-accent">{dict.onboarding.step_of}</p>
                    <h2 className="mt-2 text-xl font-black text-[var(--text-main)]">{dict.onboarding.modal_title}</h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">{dict.onboarding.modal_desc}</p>
                    <ol className="mt-10 space-y-6">
                        {steps.map((item, index) => {
                            const Icon = item.icon
                            const complete = index < stepIndex
                            const active = index === stepIndex
                            return (
                                <li key={item.label} className="flex items-center gap-3">
                                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${active ? "border-accent bg-accent text-white" : "border-accent/20 bg-accent/10 text-accent"}`}>
                                        {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--text-main)]">{item.label}</p>
                                        <p className="text-xs text-[var(--text-muted)]">{dict.onboarding.step_label} {index + 1}</p>
                                    </div>
                                </li>
                            )
                        })}
                    </ol>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="dialog-glass-chrome rounded-tr-[28px] border-b border-[var(--border-soft)] px-5 pb-5 pt-6 pr-16 sm:px-8 sm:pb-6 sm:pt-8">
                        <div className="mb-4 flex gap-1.5 md:hidden">
                            {steps.map((item, index) => (
                                <span key={item.label} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-accent" : "bg-[var(--border-soft)]"}`} />
                            ))}
                        </div>
                        <DialogTitle className="text-xl font-black text-[var(--text-main)]">
                            {step === "model" ? dict.onboarding.model_title : step === "location" ? dict.onboarding.location_title : dict.onboarding.modal_ready_title}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-[var(--text-muted)]">
                            {step === "model" ? dict.onboarding.model_subtitle : step === "location" ? dict.onboarding.location_subtitle : dict.onboarding.modal_ready_desc}
                        </DialogDescription>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
                        {step === "model" && (
                            <div className="space-y-5">
                                <div className="grid gap-3 lg:grid-cols-3">
                                    {modelOptions.map((option) => {
                                        const Icon = option.icon
                                        const active = operatingModel === option.id
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => selectOperatingModel(option.id)}
                                                aria-pressed={active}
                                                className={`glass-panel min-h-44 rounded-2xl p-5 text-left transition-colors ${active ? "surface-glass-card-accent !border-accent" : "hover:!border-accent/50"}`}
                                            >
                                                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? "bg-accent text-white" : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"}`}>
                                                    <Icon className="h-5 w-5" />
                                                </span>
                                                <span className="mt-5 block text-sm font-black text-[var(--text-main)]">{option.label}</span>
                                                <span className="mt-2 block text-xs leading-relaxed text-[var(--text-muted)]">{option.description}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                                <div className="grid gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-muted)] sm:grid-cols-3">
                                    {[dict.onboarding.model_company_setting, dict.onboarding.model_permissions_unchanged, dict.onboarding.model_change_later].map((item) => (
                                        <p key={item} className="flex gap-2 leading-relaxed"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />{item}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {step === "location" && (
                            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px]">
                                <div className="space-y-5">
                                    <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm leading-relaxed text-[var(--text-muted)]">
                                        {locationIntro}
                                    </div>
                                    <div>
                                        <Label className="text-xs font-bold uppercase text-[var(--text-muted)]">{dict.onboarding.space_type}</Label>
                                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                                            {locationOptions.map((option) => {
                                                const Icon = option.icon
                                                const active = locationType === option.id
                                                return (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => setLocationType(option.id)}
                                                        aria-pressed={active}
                                                        className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-xs font-semibold transition-colors ${active ? "border border-accent bg-accent text-white" : "surface-control-btn hover:!border-accent/50"}`}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                        <span>{option.label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <Field label={dict.onboarding.modal_data_name} value={locationName} onChange={setLocationName} placeholder={dict.onboarding.location_name_placeholder} wide />
                                        <Field label={dict.onboarding.modal_data_address} value={locationAddress} onChange={setLocationAddress} placeholder={dict.onboarding.location_address_placeholder} wide />
                                        <Field label={dict.onboarding.modal_data_city} value={locationCity} onChange={setLocationCity} placeholder={dict.onboarding.location_city_placeholder} />
                                        <Field label={dict.onboarding.modal_data_postal} value={locationPostalCode} onChange={setLocationPostalCode} placeholder="17130" />
                                    </div>
                                </div>

                                <aside className="border-l-0 border-[var(--border-soft)] lg:border-l lg:pl-6">
                                    <div className="flex items-center gap-2 text-accent">
                                        <ClipboardCheck className="h-5 w-5" />
                                        <h3 className="text-sm font-black">{dict.onboarding.starter_service_title}</h3>
                                    </div>
                                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-muted)]">{dict.onboarding.starter_service_desc}</p>
                                    <ul className="mt-4 space-y-2">
                                        {starterItems.map((item) => (
                                            <li key={item} className="flex gap-2 text-xs text-[var(--text-main)]">
                                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </aside>
                            </div>
                        )}

                        {step === "ready" && (
                            <div className="flex min-h-[320px] flex-col justify-center">
                                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                                    <Sparkles className="h-7 w-7" />
                                </div>
                                <h3 className="text-2xl font-black text-[var(--text-main)]">{dict.onboarding.ready_setup_title}</h3>
                                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">{dict.onboarding.ready_detail}</p>
                                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                                    {[
                                        { icon: MapPin, label: result?.location_name || locationName },
                                        { icon: ClipboardCheck, label: result?.template_name || dict.onboarding.starter_service_fallback },
                                        { icon: Users, label: dict.onboarding.ready_team },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-center gap-2 border-t border-[var(--border-soft)] pt-3">
                                            <item.icon className="h-4 w-4 text-accent" />
                                            <span className="text-sm font-semibold text-[var(--text-main)]">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <footer className="dialog-glass-chrome flex items-center justify-between gap-3 rounded-br-[28px] border-t border-[var(--border-soft)] px-5 py-4 sm:px-8">
                        {step === "model" && (
                            <>
                                <button type="button" onClick={() => void completeWithoutLocation()} disabled={loading} className="h-10 px-3 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-50">
                                    {dict.onboarding.modal_btn_later}
                                </button>
                                <PrimaryButton onClick={() => setStep("location")} label={dict.onboarding.next} icon={ArrowRight} disabled={modelLoading} />
                            </>
                        )}
                        {step === "location" && (
                            <>
                                <button type="button" onClick={() => setStep("model")} className="flex h-10 items-center gap-2 px-3 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)]">
                                    <ArrowLeft className="h-4 w-4" />
                                    {dict.onboarding.back}
                                </button>
                                <PrimaryButton onClick={() => void createStarterSetup()} label={loading ? dict.locations.form.saving : dict.onboarding.activate_setup} icon={ArrowRight} disabled={loading} />
                            </>
                        )}
                        {step === "ready" && (
                            <>
                                <button type="button" onClick={() => closeOnboarding("/dashboard/locations")} className="min-h-10 px-3 py-2 text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)]">
                                    {dict.onboarding.view_location}
                                </button>
                                <PrimaryButton onClick={() => closeOnboarding("/dashboard/tasks")} label={dict.onboarding.create_first_task} icon={ArrowRight} />
                            </>
                        )}
                    </footer>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Field({
    label,
    value,
    onChange,
    placeholder,
    wide = false,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder: string
    wide?: boolean
}) {
    return (
        <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
            <Label className="text-xs font-bold uppercase text-[var(--text-muted)]">{label}</Label>
            <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={fieldClass} />
        </div>
    )
}

function PrimaryButton({
    onClick,
    label,
    icon: Icon,
    disabled = false,
}: {
    onClick: () => void
    label: string
    icon: React.ComponentType<{ className?: string }>
    disabled?: boolean
}) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--btn-primary-bg)] px-5 py-2 text-sm font-semibold text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] disabled:opacity-60">
            {label}
            <Icon className="h-4 w-4" />
        </button>
    )
}
