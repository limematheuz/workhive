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

export function compressImageFile(
    file: File,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8
): Promise<File> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            resolve(file);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    resolve(file);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                            type: "image/jpeg",
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    "image/jpeg",
                    quality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
