"use client"

import React, { RefObject } from "react"
import { Sparkles, ChevronRight, ChevronLeft, X } from "lucide-react"
import { TOUR_STEPS, TourCoords, TourStep } from "./guidedTourSteps"
import { getGuidedTourTooltipPosition, Viewport } from "@/lib/guided-tour-position"

interface GuidedTourOverlayProps {
    step: number
    currentStepData: TourStep
    coords: TourCoords | null
    isMobile: boolean
    tooltipHeight: number
    viewport: Viewport
    tooltipRef: RefObject<HTMLDivElement | null>
    onNext: () => void
    onBack: () => void
    onFinish: () => void
}

export function GuidedTourOverlay({
    step,
    currentStepData,
    coords,
    isMobile,
    tooltipHeight,
    viewport,
    tooltipRef,
    onNext,
    onBack,
    onFinish,
}: GuidedTourOverlayProps) {
    const { style, arrowClass } = getGuidedTourTooltipPosition(
        isMobile,
        coords,
        currentStepData,
        tooltipHeight,
        viewport,
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
