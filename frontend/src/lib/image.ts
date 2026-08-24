const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
    "image/gif",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

export function validateImageFile(file: File): void {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        throw new Error("Only JPG, PNG, WEBP or GIF images are allowed.");
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("The image must be 4 MB or smaller.");
    }
}
