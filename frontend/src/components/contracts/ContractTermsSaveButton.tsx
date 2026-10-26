"use client"

import { useRef } from "react"

import { Button } from "@/components/ui/button"
import { useDialogFormGuardReset } from "@/components/ui/dialog-form-guard"

type ContractTermsSaveButtonProps = {
    disabled: boolean
    onSave: () => Promise<boolean>
}

export function ContractTermsSaveButton({ disabled, onSave }: ContractTermsSaveButtonProps) {
    const buttonRef = useRef<HTMLButtonElement>(null)
    const resetDirty = useDialogFormGuardReset()
    const save = async () => {
        const section = buttonRef.current?.closest("section")
        if (await onSave() && section) resetDirty(section)
    }

    return <Button ref={buttonRef} type="button" disabled={disabled} onClick={() => void save()}>Guardar condiciones</Button>
}
