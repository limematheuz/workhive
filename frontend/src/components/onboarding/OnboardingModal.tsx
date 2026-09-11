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
    Hotel,
    MapPin,
    Sparkles,
    Users,
    X,
} from "lucide-react"

import { LocationWorkspaceForm, type LocationWorkspacePayload } from "@/components/locations/LocationWorkspaceForm"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    OperatingModel,
    OnboardingLocationType,
    buildCompanyOnboardingInput,
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

function useOnboardingModalController({ user, onComplete }: OnboardingModalProps) {
    const { dict } = useDictionary()
    const router = useRouter()
    const [step, setStep] = React.useState<Step>("model")
    const [loading, setLoading] = React.useState(false)
    const [operatingModel, setOperatingModel] = React.useState<OperatingModel>("service_provider")
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

    const createStarterSetup = async (payload: LocationWorkspacePayload) => {
        if (!user.company_id) return
        const { name, address, city, postal_code, location_type, profile, access, spaces, contacts, risks, service_windows } = payload

        setLoading(true)
        try {
            const onboardingResult = await CompanyService.completeOnboarding(
                user.company_id,
                { operating_model: operatingModel, location: {
                    name, address, city, postal_code: postal_code || "",
                    location_type: (location_type || "other") as OnboardingLocationType,
                    profile, access, spaces, contacts, risks, service_windows,
                } },
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
        modelOptions,
        operatingModel,
        result,
        selectOperatingModel,
        setStep,
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
        modelOptions,
        operatingModel,
        result,
        selectOperatingModel,
        setStep,
        step,
        stepIndex,
        steps,
    } = controller

    return (
        <Dialog open onOpenChange={(open) => { if (!open) { if (step === "ready") closeOnboarding(); else void completeWithoutLocation(); } }}>
            <DialogContent
                showCloseButton={false}
                confirmDiscard={step !== "ready"}
                overlayClassName="dialog-glass-overlay"
                className="dialog-glass flex max-h-[calc(100vh-1.5rem)] w-full max-w-[calc(100%-1.5rem)] gap-0 overflow-hidden rounded-[28px] p-0 sm:max-h-[calc(100vh-3rem)] sm:max-w-5xl"
            >
                <DialogClose asChild><button
                    type="button"
                    disabled={loading || modelLoading}
                    aria-label={dict.onboarding.modal_btn_later}
                    data-slot="dialog-close"
                    className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-main)] transition-colors disabled:opacity-50"
                >
                    <X className="h-5 w-5" />
                </button></DialogClose>

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

                        <div hidden={step !== "location"} className="h-[min(68vh,760px)] min-h-0">
                            <LocationWorkspaceForm clients={[]} portalMode requirePostalCode submitting={loading}
                                submitLabel={dict.onboarding.activate_setup} onSubmit={createStarterSetup}
                                onCancel={() => void completeWithoutLocation()} />
                        </div>

                        {step === "ready" && (
                            <div className="flex min-h-[320px] flex-col justify-center">
                                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                                    <Sparkles className="h-7 w-7" />
                                </div>
                                <h3 className="text-2xl font-black text-[var(--text-main)]">{dict.onboarding.ready_setup_title}</h3>
                                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">{dict.onboarding.ready_detail}</p>
                                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                                    {[
                                        { icon: MapPin, label: result?.location_name || dict.onboarding.location_title },
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
                                <span className="text-xs text-[var(--text-muted)]">{dict.onboarding.location_subtitle}</span>
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
