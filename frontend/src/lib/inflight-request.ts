export type InflightRequestDeduper = <T>(
    key: string,
    request: () => Promise<T>,
) => Promise<T>;

export function createInflightRequestDeduper(): InflightRequestDeduper {
    const requests = new Map<string, Promise<unknown>>();

    return <T>(key: string, request: () => Promise<T>): Promise<T> => {
        const active = requests.get(key) as Promise<T> | undefined;
        if (active) return active;

        const pending = request();
        requests.set(key, pending);
        const clear = () => {
            if (requests.get(key) === pending) requests.delete(key);
        };
        pending.then(clear, clear);
        return pending;
    };
}
