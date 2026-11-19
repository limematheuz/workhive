"use client";
import { useEffect, useState } from "react";

export function useStaffConsultationLayout() {
    const [container, setContainer] = useState<HTMLDivElement | null>(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        if (!container) return;
        const observer = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));
        observer.observe(container);
        return () => observer.disconnect();
    }, [container]);
    return { containerRef: setContainer, split: width >= 560 + 16 + 360 };
}
