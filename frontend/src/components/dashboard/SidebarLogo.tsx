"use client";

import Image from "next/image";
import { SIDEBAR_LOGO_STYLE } from "./sidebar-nav-config";

type SidebarLogoProps = {
    isOpen: boolean;
};

export function SidebarLogo({ isOpen }: SidebarLogoProps) {
    return (
        <div
            className={`relative z-10 flex shrink-0 items-center overflow-hidden transition-all duration-300 h-16 max-lg:h-[4.75rem] lg:h-[4.25rem] ${
                isOpen ? "px-4 pb-1 max-lg:pb-2" : "justify-center"
            }`}
        >
            {isOpen ? (
                <Image
                    src="/logo/black-logo.avif"
                    alt="WorkHive"
                    width={481}
                    height={123}
                    priority
                    sizes="144px"
                    unoptimized
                    style={SIDEBAR_LOGO_STYLE}
                    className="w-36 h-auto opacity-90"
                />
            ) : (
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
                    style={{
                        backgroundColor: "var(--sidebar-active-bg)",
                        color: "var(--sidebar-active-text)",
                        border: "1px solid var(--sidebar-active-border)",
                    }}
                >
                    WH
                </div>
            )}
        </div>
    );
}
