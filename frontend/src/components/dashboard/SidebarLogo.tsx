"use client";

import { WorkHiveLogo } from "@/components/brand/WorkHiveLogo";

type SidebarLogoProps = {
    isOpen: boolean;
};

export function SidebarLogo({ isOpen }: SidebarLogoProps) {
    return (
        <div
            className={`relative z-10 flex shrink-0 items-center overflow-hidden ui-motion duration-300 h-16 max-lg:h-[4.5rem] lg:h-16 ${
                isOpen ? "justify-center px-4" : "justify-center"
            }`}
        >
            <WorkHiveLogo compact={!isOpen} className={isOpen ? "w-36" : "w-8"} priority />
        </div>
    );
}
