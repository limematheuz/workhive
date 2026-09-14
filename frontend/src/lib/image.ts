const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
export const MAX_QUALITY_EVIDENCE_BYTES = 1 * 1024 * 1024;
export const QUALITY_EVIDENCE_TARGET_BYTES = 850 * 1024;
const MAX_QUALITY_EVIDENCE_SOURCE_BYTES = 10 * 1024 * 1024;
const QUALITY_EVIDENCE_MAX_DIMENSION = 1_920;
const COMPRESSION_QUALITIES = [0.82, 0.72, 0.62, 0.52];
const MAX_COMPRESSION_RESIZES = 5;
const ALLOWED_IMAGE_TYPES = new Set([
    "image/gif",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

function validateSupportedImageType(file: File): void {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new Error("Only JPG, PNG, WEBP or GIF images are allowed.");
    }
}

export function validateImageFile(file: File): void {
    validateSupportedImageType(file);
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("The image must be 4 MB or smaller.");
    }
}

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => {
            reject(new Error("No se pudo leer la foto seleccionada."));
        };
        reader.onload = () => {
            if (typeof reader.result !== "string") {
                reject(new Error("No se pudo leer la foto seleccionada."));
                return;
            }
            const image = document.createElement("img");
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error("No se pudo leer la foto seleccionada."));
            image.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            reject(new Error("No se pudo comprimir la foto seleccionada."));
        }, "image/webp", quality);
    });
}

function compressedFileName(file: File, type: string): string {
    const baseName = file.name.replace(/\.[^.]+$/, "") || "evidencia";
    const extension = type === "image/webp" ? "webp" : "jpg";
    return `${baseName}.${extension}`;
}

/**
 * Reencodes quality evidence in the browser before upload. The API still
 * enforces MAX_QUALITY_EVIDENCE_BYTES, so a modified client cannot bypass it.
 */
export async function compressQualityEvidenceImage(file: File): Promise<File> {
    validateSupportedImageType(file);
    if (file.size > MAX_QUALITY_EVIDENCE_SOURCE_BYTES) {
        throw new Error("La foto original no puede superar 10 MB.");
    }
    if (file.size <= QUALITY_EVIDENCE_TARGET_BYTES) {
        return file;
    }
    if (file.type === "image/gif") {
        throw new Error(
            "Los GIF grandes no se pueden comprimir sin perder su animación. Elige una foto JPG, PNG o WEBP de menos de 1 MB.",
        );
    }

    const image = await loadImage(file);
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    let scale = Math.min(1, QUALITY_EVIDENCE_MAX_DIMENSION / largestSide);
    let smallestBlob: Blob | undefined;

    for (let resizeAttempt = 0; resizeAttempt < MAX_COMPRESSION_RESIZES; resizeAttempt += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("No se pudo preparar la foto para subirla.");
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        for (const quality of COMPRESSION_QUALITIES) {
            const blob = await canvasToBlob(canvas, quality);
            if (!smallestBlob || blob.size < smallestBlob.size) {
                smallestBlob = blob;
            }
            if (blob.size <= QUALITY_EVIDENCE_TARGET_BYTES) {
                return new File([blob], compressedFileName(file, blob.type), {
                    type: blob.type,
                    lastModified: file.lastModified,
                });
            }
        }
        scale *= 0.75;
    }

    if (smallestBlob && smallestBlob.size <= MAX_QUALITY_EVIDENCE_BYTES) {
        return new File([smallestBlob], compressedFileName(file, smallestBlob.type), {
            type: smallestBlob.type,
            lastModified: file.lastModified,
        });
    }
    throw new Error("No se pudo reducir la foto a 1 MB. Prueba con otra foto o recórtala.");
}
