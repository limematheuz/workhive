import { Button } from "@/components/ui/button"
import { useDictionary } from "@/lib/dictionary-context"

interface LocationFormActionsProps {
    isLoading: boolean
    onCancel: () => void
}

export function LocationFormActions({ isLoading, onCancel }: LocationFormActionsProps) {
    const { dict } = useDictionary()

    return (
        <div className="p-6 pt-4 flex gap-3 border-t border-[var(--border-soft)] bg-[var(--bg-card)] flex-shrink-0">
            <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="w-1/2 bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)] border border-[var(--btn-cancel-border)] hover:bg-[var(--btn-cancel-hover-bg)] hover:text-[var(--btn-cancel-hover-text)] hover:border-transparent text-xs font-semibold rounded-xl px-5 py-2.5 cursor-pointer transition-all"
            >
                {dict.locations.form.cancel}
            </Button>
            <Button
                type="submit"
                disabled={isLoading}
                className="w-1/2 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] text-xs font-semibold rounded-xl px-5 py-2.5 border border-[var(--border-soft)] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
                {isLoading ? dict.locations.form.saving : dict.locations.form.save}
            </Button>
        </div>
    )
}
