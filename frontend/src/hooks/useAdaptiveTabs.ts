"use client";

import { useEffect, useRef, useState } from "react";
import { shouldCollapseTabs } from "@/lib/tab-navigation-layout";

export function useAdaptiveTabs(count: number) {
    const containerRef = useRef<HTMLDivElement>(null);
    const measurementRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState({ dropdown: true, ready: false });

    useEffect(() => {
        const container = containerRef.current;
        const measurement = measurementRef.current;
        if (!container || !measurement) return;
        const measure = () => {
            const dropdown = shouldCollapseTabs({
                count,
                viewportWidth: window.innerWidth,
                availableWidth: container.clientWidth,
                requiredWidth: measurement.getBoundingClientRect().width,
            });
            setLayout(previous => previous.ready && previous.dropdown === dropdown
                ? previous : { dropdown, ready: true });
        };
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        observer.observe(measurement);
        window.addEventListener("resize", measure);
        measure();
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [count]);

    return { containerRef, measurementRef, ...layout };
}
