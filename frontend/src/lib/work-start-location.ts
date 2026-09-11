export interface WorkStartLocation {
    start_latitude: number;
    start_longitude: number;
    start_accuracy_meters: number | null;
}

export interface WorkEndLocation {
    end_latitude: number;
    end_longitude: number;
    end_accuracy_meters: number | null;
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

export async function getCurrentWorkEndLocation(): Promise<WorkEndLocation> {
    const location = await getCurrentWorkStartLocation();
    return {
        end_latitude: location.start_latitude,
        end_longitude: location.start_longitude,
        end_accuracy_meters: location.start_accuracy_meters,
    };
}

export function buildWorkStartMapUrl(
    latitude: number,
    longitude: number
): string {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
