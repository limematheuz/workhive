import LoginPageClient from "./LoginPageClient";

const DEFAULT_RETURN_PATH = "/dashboard";

function resolveLoginReturnPath(next: string | string[] | undefined): string {
    if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
        return DEFAULT_RETURN_PATH;
    }

    return next === "/accept-company-invitation" || next.startsWith("/dashboard")
        ? next
        : DEFAULT_RETURN_PATH;
}

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string | string[] }>;
}) {
    const { next } = await searchParams;
    return <LoginPageClient returnTo={resolveLoginReturnPath(next)} />;
}
