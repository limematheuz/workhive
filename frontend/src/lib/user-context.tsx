"use client";

import React, {
    createContext,
    use,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import { authService } from "@/services/auth.service";
import { User } from "@/types/user";
import { USER_CACHE_KEY, LEGACY_USER_CACHE_KEY, getSessionReadContext } from "@/lib/auth";
import { mayRecoverCachedSession } from "@/lib/session-read-recovery";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";

interface UserContextType {
    user: User | null;
    loading: boolean;
    connectionUnavailable: boolean;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function readCachedUser(allowOfflineIdentity = false): User | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(USER_CACHE_KEY);
        if (raw) return JSON.parse(raw) as User;

        const legacyRaw = sessionStorage.getItem(LEGACY_USER_CACHE_KEY);
        if (!legacyRaw) {
            return allowOfflineIdentity || !navigator.onLine
                ? JSON.parse(localStorage.getItem("workhive_offline_identity:v1") ?? "null") as User | null
                : null;
        }

        const legacyUser = JSON.parse(legacyRaw) as User;
        sessionStorage.setItem(USER_CACHE_KEY, legacyRaw);
        sessionStorage.removeItem(LEGACY_USER_CACHE_KEY);
        return legacyUser;
    } catch {
        return null;
    }
}

function writeCachedUser(user: User | null): void {
    if (typeof window === "undefined") return;
    if (user) {
        sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } else {
        sessionStorage.removeItem(USER_CACHE_KEY);
    }
    sessionStorage.removeItem(LEGACY_USER_CACHE_KEY);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [connectionUnavailable, setConnectionUnavailable] = useState(false);
    const recoverRead = useCallback((error: unknown) => {
        const recover = mayRecoverCachedSession(error, window.location.pathname, navigator.onLine);
        const cached = recover ? readCachedUser(true) : null;
        setUser(cached);
        setConnectionUnavailable(Boolean(cached));
        if (!cached) writeCachedUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        const sessionContext = getSessionReadContext();
        try {
            const userData = await Promise.race([
                authService.getMe(),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error("Timeout: API did not respond")),
                        10000
                    )
                ),
            ]);
            if (sessionContext !== getSessionReadContext()) return;
            setUser(userData);
            setConnectionUnavailable(false);
            writeCachedUser(userData);
        } catch (error) {
            if (sessionContext === getSessionReadContext()) recoverRead(error);
        } finally {
            setLoading(false);
        }
    }, [recoverRead]);
    useBackgroundPolling(() => {
        if (connectionUnavailable) return refreshUser();
    }, POLL_INTERVALS.liveWork);

    useEffect(() => {
        let cancelled = false;
        const sessionContext = getSessionReadContext();
        (async () => {
            try {
                const userData = await Promise.race([
                    authService.getMe(),
                    new Promise<never>((_, reject) =>
                        setTimeout(
                            () => reject(new Error("Timeout: API did not respond")),
                            10000
                        )
                    ),
                ]);
                if (!cancelled && sessionContext === getSessionReadContext()) {
                    setUser(userData);
                    setConnectionUnavailable(false);
                    writeCachedUser(userData);
                }
            } catch (error) {
                if (!cancelled && sessionContext === getSessionReadContext()) {
                    recoverRead(error);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [recoverRead]);

    useEffect(() => {
        const onPageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                const cached = readCachedUser();
                if (cached) {
                    setUser(cached);
                    setLoading(false);
                }
                refreshUser();
            }
        };
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, [refreshUser]);

    const value = useMemo(
        () => ({ user, loading, connectionUnavailable, refreshUser }),
        [user, loading, connectionUnavailable, refreshUser]
    );

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = use(UserContext);
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}
