import { apiFetch } from "@/lib/api"
import { compressImageForUpload } from "@/lib/image"

export const UploadService = {
    uploadFile: async (file: File, folder: string = "general"): Promise<{ url: string }> => {
        const compressedFile = await compressImageForUpload(file)
        const formData = new FormData()
        formData.append("file", compressedFile)

        const response = await apiFetch(`/api/v1/uploads/?folder=${folder}`, {
            method: "POST",
            body: formData,
        })

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}))
            throw new Error(errData.detail || "Error al subir el archivo")
        }

        return await response.json()
    }
}
