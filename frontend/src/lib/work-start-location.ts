class UnsupportedWorkLocationError extends Error {
    constructor() {
        super("Geolocation is not supported");
        this.name = "UnsupportedWorkLocationError";
    }
}

export function getWorkLocationErrorKey(error: unknown): "location_required" | "location_unavailable" | "location_timeout" | "location_unsupported" {
    if (error instanceof UnsupportedWorkLocationError) return "location_unsupported";
    if (error && typeof error === "object" && "code" in error) {
        if (error.code === 1) return "location_required";
        if (error.code === 3) return "location_timeout";
    }
    return "location_unavailable";
}

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
        return Promise.reject(new UnsupportedWorkLocationError());
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
