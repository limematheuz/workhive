export interface WorkStartLocation {
    start_latitude: number;
    start_longitude: number;
    start_accuracy_meters: number | null;
}

export function getCurrentWorkStartLocation(): Promise<WorkStartLocation> {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
        return Promise.reject(new Error("Geolocation is not supported"));
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                resolve({
                    start_latitude: coords.latitude,
                    start_longitude: coords.longitude,
                    start_accuracy_meters: Number.isFinite(coords.accuracy)
                        ? coords.accuracy
                        : null,
                });
            },
            reject,
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15_000,
            }
        );
    });
}

export function buildWorkStartMapUrl(
    latitude: number,
    longitude: number
): string {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
