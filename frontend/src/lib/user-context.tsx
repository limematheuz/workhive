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

interface UserContextType {
    user: User | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
}

const USER_CACHE_KEY = "workhive_user_cache:v1";
const USER_CACHE_KEY_LEGACY = "workhive_user_cache";

const UserContext = createContext<UserContextType | undefined>(undefined);

function readCachedUser(): User | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(USER_CACHE_KEY);
        if (raw) return JSON.parse(raw) as User;

        const legacyRaw = sessionStorage.getItem(USER_CACHE_KEY_LEGACY);
        if (!legacyRaw) return null;

        const legacyUser = JSON.parse(legacyRaw) as User;
        sessionStorage.setItem(USER_CACHE_KEY, legacyRaw);
        sessionStorage.removeItem(USER_CACHE_KEY_LEGACY);
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
    sessionStorage.removeItem(USER_CACHE_KEY_LEGACY);
}

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
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
            setUser(userData);
            writeCachedUser(userData);
        } catch {
            setUser(null);
            writeCachedUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
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
                if (!cancelled) {
                    setUser(userData);
                    writeCachedUser(userData);
                }
            } catch {
                if (!cancelled) {
                    setUser(null);
                    writeCachedUser(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

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
        () => ({ user, loading, refreshUser }),
        [user, loading, refreshUser]
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
