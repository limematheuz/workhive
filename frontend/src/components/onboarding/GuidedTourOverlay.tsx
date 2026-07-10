"use client"

import React, { RefObject } from "react"
import { Sparkles, ChevronRight, ChevronLeft, X } from "lucide-react"
import { TOUR_STEPS, TourCoords, TourStep } from "./guidedTourSteps"

interface GuidedTourOverlayProps {
    step: number
    currentStepData: TourStep
    coords: TourCoords | null
    isMobile: boolean
    tooltipHeight: number
    tooltipRef: RefObject<HTMLDivElement | null>
    onNext: () => void
    onBack: () => void
    onFinish: () => void
}

function getTooltipStyleAndArrow(
    isMobile: boolean,
    coords: TourCoords | null,
    currentStepData: TourStep,
    tooltipHeight: number,
) {
    if (isMobile) {
        return {
            style: {
                position: "fixed" as const,
                bottom: "24px",
                left: "16px",
                right: "16px",
                width: "auto",
                maxWidth: "calc(100% - 32px)",
                zIndex: 10000,
            },
            arrowClass: "hidden"
        }
    }

    if (!coords) {
        return {
            style: {
                position: "fixed" as const,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
            },
            arrowClass: "hidden"
        }
    }

    const margin = 16
    const tooltipWidth = 320
    let top = coords.top
    let left = coords.left

    let arrowClass = ""
    const baseArrow = "absolute w-3 h-3 rotate-45 bg-[var(--popover-tour-bg)] border-[var(--popover-tour-border)]"

    if (currentStepData.placement === "bottom") {
        top = coords.top + coords.height + margin
        left = coords.left
        let useRightArrow = false

        if (typeof window !== "undefined") {
            if (left + tooltipWidth > window.innerWidth - 16) {
                left = coords.left + coords.width - tooltipWidth
                useRightArrow = true
            }
            if (left < 16) {
                left = 16
                useRightArrow = false
            }
        }

        arrowClass = useRightArrow
            ? `${baseArrow} top-[-6px] right-6 border-l border-t`
            : `${baseArrow} top-[-6px] left-6 border-l border-t`

    } else if (currentStepData.placement === "top") {
        top = coords.top - tooltipHeight - margin
        left = coords.left
        let useRightArrow = false

        if (typeof window !== "undefined") {
            if (left + tooltipWidth > window.innerWidth - 16) {
                left = coords.left + coords.width - tooltipWidth
                useRightArrow = true
            }
            if (left < 16) {
                left = 16
                useRightArrow = false
            }
        }

        arrowClass = useRightArrow
            ? `${baseArrow} bottom-[-6px] right-6 border-r border-b`
            : `${baseArrow} bottom-[-6px] left-6 border-r border-b`

    } else if (currentStepData.placement === "left") {
        left = coords.left - tooltipWidth - margin
        top = coords.top
        let useBottomArrow = false

        if (typeof window !== "undefined") {
            if (top + tooltipHeight > window.innerHeight - 16) {
                top = coords.top + coords.height - tooltipHeight
                useBottomArrow = true
            }
            if (top < 16) {
                top = 16
                useBottomArrow = false
            }
        }

        arrowClass = useBottomArrow
            ? `${baseArrow} right-[-6px] bottom-6 border-r border-t`
            : `${baseArrow} right-[-6px] top-6 border-r border-t`

    } else if (currentStepData.placement === "right") {
        left = coords.left + coords.width + margin
        top = coords.top
        let useBottomArrow = false

        if (typeof window !== "undefined") {
            if (top + tooltipHeight > window.innerHeight - 16) {
                top = coords.top + coords.height - tooltipHeight
                useBottomArrow = true
            }
            if (top < 16) {
                top = 16
                useBottomArrow = false
            }
        }

        arrowClass = useBottomArrow
            ? `${baseArrow} left-[-6px] bottom-6 border-l border-b`
            : `${baseArrow} left-[-6px] top-6 border-l border-b`
    }

    if (typeof window !== "undefined") {
        if (left < 10) left = 10
        if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10
        if (top < 10) top = 10
    }

    return {
        style: {
            position: "absolute" as const,
            top: `${top}px`,
            left: `${left}px`,
            width: `${tooltipWidth}px`,
        },
        arrowClass
    }
}

export function GuidedTourOverlay({
    step,
    currentStepData,
    coords,
    isMobile,
    tooltipHeight,
    tooltipRef,
    onNext,
    onBack,
    onFinish,
}: GuidedTourOverlayProps) {
    const { style, arrowClass } = getTooltipStyleAndArrow(
        isMobile,
        coords,
        currentStepData,
        tooltipHeight,
    )

    return (
        <div className="fixed inset-0 z-[10000] pointer-events-none">
            {/* Soft transparent overlay blocker */}
            <div className="absolute inset-0 bg-black/15 pointer-events-auto" />

            {/* Tooltip Card */}
            <div
                ref={tooltipRef}
                style={style}
                className="pointer-events-auto bg-[var(--popover-tour-bg)] border border-[var(--popover-tour-border)] text-[var(--popover-tour-text)] rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            >
                {/* Connecting Arrow (Desktop only) */}
                {arrowClass !== "hidden" && <div className={arrowClass} />}

                <button type="button"
                    onClick={onFinish}
                    aria-label="Cerrar"
                    className="absolute top-3 right-3 text-[var(--popover-tour-text-muted)] hover:text-[var(--popover-tour-text)] p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                >
                    <X className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2 mb-2 text-[var(--popover-tour-text)] font-black">
                    <Sparkles className="w-4 h-4 text-[var(--popover-tour-text)]" />
                    <h4 className="text-sm font-bold">{currentStepData.title}</h4>
                </div>

                <p className="text-xs text-[var(--popover-tour-text-muted)] leading-relaxed mb-4">
                    {currentStepData.content}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--popover-tour-border)]">
                    <span className="text-[10px] font-semibold text-[var(--popover-tour-text-muted)]">
                        {step + 1} / {TOUR_STEPS.length}
                    </span>
                    <div className="flex gap-1.5">
                        {step > 0 && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold text-[var(--popover-tour-text-muted)] hover:text-[var(--popover-tour-text)] bg-transparent border border-[var(--popover-tour-border)] rounded-lg transition-colors cursor-pointer"
                            >
                                <ChevronLeft className="w-3 h-3" />
                                Atrás
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onNext}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold bg-[var(--popover-tour-text)] text-[var(--popover-tour-bg)] hover:opacity-90 rounded-lg transition-colors cursor-pointer border-none"
                        >
                            {step === TOUR_STEPS.length - 1 ? "Entendido" : "Siguiente"}
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
