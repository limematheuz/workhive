type TourPlacement = "top" | "bottom" | "left" | "right";

type TourCoords = {
    top: number;
    left: number;
    width: number;
    height: number;
};

type PositionedTourStep = {
    placement: TourPlacement;
};

export type Viewport = {
    width: number;
    height: number;
};

type GuidedTourTooltipPosition = {
    style: {
        position: "absolute" | "fixed";
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
        width?: string;
        maxWidth?: string;
        transform?: string;
        zIndex?: number;
    };
    arrowClass: string;
};

const viewportIsKnown = (viewport: Viewport) =>
    viewport.width > 0 && viewport.height > 0;

export function getGuidedTourTooltipPosition(
    isMobile: boolean,
    coords: TourCoords | null,
    currentStepData: PositionedTourStep,
    tooltipHeight: number,
    viewport: Viewport,
): GuidedTourTooltipPosition {
    if (isMobile) {
        return {
            style: {
                position: "fixed",
                bottom: "24px",
                left: "16px",
                right: "16px",
                width: "auto",
                maxWidth: "calc(100% - 32px)",
                zIndex: 10000,
            },
            arrowClass: "hidden",
        };
    }

    if (!coords) {
        return {
            style: {
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
            },
            arrowClass: "hidden",
        };
    }

    const margin = 16;
    const tooltipWidth = 320;
    const baseArrow = "absolute w-3 h-3 rotate-45 bg-[var(--popover-tour-bg)] border-[var(--popover-tour-border)]";
    let top = coords.top;
    let left = coords.left;
    let arrowClass = "";

    if (currentStepData.placement === "bottom") {
        top = coords.top + coords.height + margin;
        left = coords.left;
        let useRightArrow = false;

        if (viewportIsKnown(viewport)) {
            if (left + tooltipWidth > viewport.width - 16) {
                left = coords.left + coords.width - tooltipWidth;
                useRightArrow = true;
            }
            if (left < 16) {
                left = 16;
                useRightArrow = false;
            }
        }

        arrowClass = useRightArrow
            ? `${baseArrow} top-[-6px] right-6 border-l border-t`
            : `${baseArrow} top-[-6px] left-6 border-l border-t`;
    } else if (currentStepData.placement === "top") {
        top = coords.top - tooltipHeight - margin;
        left = coords.left;
        let useRightArrow = false;

        if (viewportIsKnown(viewport)) {
            if (left + tooltipWidth > viewport.width - 16) {
                left = coords.left + coords.width - tooltipWidth;
                useRightArrow = true;
            }
            if (left < 16) {
                left = 16;
                useRightArrow = false;
            }
        }

        arrowClass = useRightArrow
            ? `${baseArrow} bottom-[-6px] right-6 border-r border-b`
            : `${baseArrow} bottom-[-6px] left-6 border-r border-b`;
    } else if (currentStepData.placement === "left") {
        left = coords.left - tooltipWidth - margin;
        top = coords.top;
        let useBottomArrow = false;

        if (viewportIsKnown(viewport)) {
            if (top + tooltipHeight > viewport.height - 16) {
                top = coords.top + coords.height - tooltipHeight;
                useBottomArrow = true;
            }
            if (top < 16) {
                top = 16;
                useBottomArrow = false;
            }
        }

        arrowClass = useBottomArrow
            ? `${baseArrow} right-[-6px] bottom-6 border-r border-t`
            : `${baseArrow} right-[-6px] top-6 border-r border-t`;
    } else if (currentStepData.placement === "right") {
        left = coords.left + coords.width + margin;
        top = coords.top;
        let useBottomArrow = false;

        if (viewportIsKnown(viewport)) {
            if (top + tooltipHeight > viewport.height - 16) {
                top = coords.top + coords.height - tooltipHeight;
                useBottomArrow = true;
            }
            if (top < 16) {
                top = 16;
                useBottomArrow = false;
            }
        }

        arrowClass = useBottomArrow
            ? `${baseArrow} left-[-6px] bottom-6 border-l border-b`
            : `${baseArrow} left-[-6px] top-6 border-l border-b`;
    }

    if (viewportIsKnown(viewport)) {
        if (left < 10) left = 10;
        if (left + tooltipWidth > viewport.width - 10) left = viewport.width - tooltipWidth - 10;
        if (top < 10) top = 10;
    }

    return {
        style: {
            position: "absolute",
            top: `${top}px`,
            left: `${left}px`,
            width: `${tooltipWidth}px`,
        },
        arrowClass,
    };
}
