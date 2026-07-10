"use client"

import React, { useState, useEffect, useRef } from "react"
import { User } from "@/types/user"
import { TOUR_STEPS, TourCoords } from "./guidedTourSteps"
import { GuidedTourOverlay } from "./GuidedTourOverlay"

interface GuidedTourProps {
    user: User
    onComplete: () => void
}

export function GuidedTour({ user, onComplete }: GuidedTourProps) {
    const [step, setStep] = useState(0)
    const [coords, setCoords] = useState<TourCoords | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [tooltipHeight, setTooltipHeight] = useState(160)
    const tooltipRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        checkMobile()
        window.addEventListener("resize", checkMobile)
        return () => window.removeEventListener("resize", checkMobile)
    }, [])

    // Control sidebar state programmatically depending on the current step
    useEffect(() => {
        if (step === 4) {
            window.dispatchEvent(new CustomEvent("workhive_set_sidebar_open", { detail: true }));
        } else {
            window.dispatchEvent(new CustomEvent("workhive_set_sidebar_open", { detail: false }));
        }
    }, [step]);

    // Ensure the sidebar closes when the tour unmounts
    useEffect(() => {
        return () => {
            window.dispatchEvent(new CustomEvent("workhive_set_sidebar_open", { detail: false }));
        };
    }, []);

    useEffect(() => {
        const updatePosition = () => {
            const currentStep = TOUR_STEPS[step]
            if (!currentStep) return

            const delay = step === 4 ? 350 : 150;

            const measure = () => {
                const element = document.querySelector(currentStep.selector)
                if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" })

                    setTimeout(() => {
                        const rect = element.getBoundingClientRect()
                        setCoords({
                            top: rect.top + window.scrollY,
                            left: rect.left + window.scrollX,
                            width: rect.width,
                            height: rect.height,
                        })
                    }, 150)
                } else {
                    setCoords(null)
                }
            }

            if (step === 4) {
                setTimeout(measure, delay);
            } else {
                measure();
            }
        }

        updatePosition()
        window.addEventListener("resize", updatePosition)
        window.addEventListener("scroll", updatePosition)
        return () => {
            window.removeEventListener("resize", updatePosition)
            window.removeEventListener("scroll", updatePosition)
        }
    }, [step])

    // Measure the actual height of the tooltip to position it perfectly on the vertical axis
    useEffect(() => {
        if (tooltipRef.current) {
            setTooltipHeight(tooltipRef.current.offsetHeight)
        }
    }, [step, coords])

    if (step >= TOUR_STEPS.length) {
        return null
    }

    const currentStepData = TOUR_STEPS[step]

    const handleNext = () => {
        if (step < TOUR_STEPS.length - 1) {
            setStep(step + 1)
        } else {
            handleFinish()
        }
    }

    const handleBack = () => {
        if (step > 0) {
            setStep(step - 1)
        }
    }

    const handleFinish = () => {
        localStorage.setItem(`workhive_guided_tour_done_${user.id}`, "true")
        window.dispatchEvent(new CustomEvent("workhive_set_sidebar_open", { detail: false }));
        onComplete()
    }

    return (
        <GuidedTourOverlay
            step={step}
            currentStepData={currentStepData}
            coords={coords}
            isMobile={isMobile}
            tooltipHeight={tooltipHeight}
            tooltipRef={tooltipRef}
            onNext={handleNext}
            onBack={handleBack}
            onFinish={handleFinish}
        />
    )
}
