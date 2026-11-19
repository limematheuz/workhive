/** Give the browser time to consume a private blob before releasing its URL. */
export function downloadBlob(blob: Blob, fileName: string): void {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    try {
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
    } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
