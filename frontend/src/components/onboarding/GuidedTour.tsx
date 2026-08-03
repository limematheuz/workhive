"use client"

import React, { useState, useEffect, useRef } from "react"
import { User } from "@/types/user"
import { TOUR_STEPS, TourCoords } from "./guidedTourSteps"
import { GuidedTourOverlay } from "./GuidedTourOverlay"
import { Viewport } from "@/lib/guided-tour-position"

interface GuidedTourProps {
    user: User
    onComplete: () => void
}

export function GuidedTour({ user, onComplete }: GuidedTourProps) {
    const [step, setStep] = useState(0)
    const [coords, setCoords] = useState<TourCoords | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 })
    const [tooltipHeight, setTooltipHeight] = useState(160)
    const tooltipRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const updateViewport = () => {
            setIsMobile(window.innerWidth < 768)
            setViewport({ width: window.innerWidth, height: window.innerHeight })
        }
        updateViewport()
        window.addEventListener("resize", updateViewport)
        return () => window.removeEventListener("resize", updateViewport)
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
        let delayedMeasure: number | undefined
        let coordinateMeasure: number | undefined

        const clearScheduledMeasurements = () => {
            if (delayedMeasure !== undefined) window.clearTimeout(delayedMeasure)
            if (coordinateMeasure !== undefined) window.clearTimeout(coordinateMeasure)
        }

        const updatePosition = (shouldScrollIntoView: boolean) => {
            clearScheduledMeasurements()
            const currentStep = TOUR_STEPS[step]
            if (!currentStep) return

            const measure = () => {
                const element = document.querySelector(currentStep.selector)
                if (element) {
                    if (shouldScrollIntoView) {
                        element.scrollIntoView({ behavior: "smooth", block: "center" })
                    }

                    coordinateMeasure = window.setTimeout(() => {
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

            if (step === 4 && shouldScrollIntoView) {
                delayedMeasure = window.setTimeout(measure, 350)
            } else {
                measure();
            }
        }

        const handleViewportChange = () => updatePosition(false)

        updatePosition(true)
        window.addEventListener("resize", handleViewportChange)
        window.addEventListener("scroll", handleViewportChange)
        return () => {
            clearScheduledMeasurements()
            window.removeEventListener("resize", handleViewportChange)
            window.removeEventListener("scroll", handleViewportChange)
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
            viewport={viewport}
            tooltipRef={tooltipRef}
            onNext={handleNext}
            onBack={handleBack}
            onFinish={handleFinish}
        />
    )
}
