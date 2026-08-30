import LoginPageClient from "./LoginPageClient";
import { resolvePostLoginPath } from "@/lib/auth-routes";

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string | string[] }>;
}) {
    const { next } = await searchParams;
    return <LoginPageClient returnTo={resolvePostLoginPath(next)} />;
}
