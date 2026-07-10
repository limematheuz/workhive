"use client"

import Image from "next/image"
import { useState } from "react"
import { resolveApiMediaUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

interface UserAvatarProps {
    name?: string | null
    email?: string | null
    photoUrl?: string | null
    className?: string
    textClassName?: string
}

function getInitials(name?: string | null, email?: string | null): string {
    if (name?.trim()) {
        const parts = name.trim().split(/\s+/)
        if (parts.length > 1) {
            return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        }
        return parts[0].slice(0, 2).toUpperCase()
    }

    if (email?.trim()) {
        return email.trim().slice(0, 2).toUpperCase()
    }

    return "U"
}

export function UserAvatar({
    name,
    email,
    photoUrl,
    className,
    textClassName,
}: UserAvatarProps) {
    const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)
    const resolvedPhotoUrl = resolveApiMediaUrl(photoUrl)
    const canShowImage = Boolean(resolvedPhotoUrl && failedPhotoUrl !== resolvedPhotoUrl)

    return (
        <div
            className={cn(
                "relative rounded-full bg-gradient-to-tr from-accent/25 to-accent flex items-center justify-center overflow-hidden text-white font-black select-none",
                className
            )}
        >
            {resolvedPhotoUrl && canShowImage ? (
                <Image
                    src={resolvedPhotoUrl}
                    alt={name || email || "Avatar"}
                    fill
                    sizes="64px"
                    className="object-cover"
                    onError={() => setFailedPhotoUrl(resolvedPhotoUrl)}
                    unoptimized
                />
            ) : (
                <span className={cn("leading-none", textClassName)}>
                    {getInitials(name, email)}
                </span>
            )}
        </div>
    )
}
