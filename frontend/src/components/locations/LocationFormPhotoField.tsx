import Image from "next/image"
import { Upload, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { resolveApiMediaUrl } from "@/lib/api"
import { useDictionary } from "@/lib/dictionary-context"

interface LocationFormPhotoFieldProps {
    photoUrl: string
    uploadingPhoto: boolean
    onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function LocationFormPhotoField({
    photoUrl,
    uploadingPhoto,
    onPhotoUpload,
}: LocationFormPhotoFieldProps) {
    const { dict } = useDictionary()

    return (
        <div className="space-y-2">
            <Label className="text-[var(--text-main)]">{dict.locations.form.photo_label}</Label>
            <div className="border border-dashed border-[var(--border-color)] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors h-36 relative overflow-hidden group">
                {uploadingPhoto ? (
                    <div className="text-center space-y-1">
                        <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
                        <span className="text-2xs font-semibold text-[var(--text-muted)] block">{dict.locations.form.photo_uploading}</span>
                    </div>
                ) : photoUrl ? (
                    <>
                        <Image
                            src={resolveApiMediaUrl(photoUrl) || ""}
                            alt={dict.locations.form.photo_alt}
                            fill
                            sizes="(max-width: 768px) 100vw, 28rem"
                            className="object-contain rounded-lg"
                            unoptimized
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload className="w-5 h-5 text-white" />
                        </div>
                    </>
                ) : (
                    <div className="text-center space-y-1">
                        <Upload className="w-5 h-5 text-accent mx-auto" />
                        <span className="text-2xs font-semibold text-[var(--text-main)] block">
                            {dict.locations.form.photo_placeholder}
                        </span>
                    </div>
                )}
                <input
                    type="file"
                    accept="image/*"
                    onChange={onPhotoUpload}
                    disabled={uploadingPhoto}
                    aria-label={dict.locations.form.photo_label}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
            </div>
        </div>
    )
}
