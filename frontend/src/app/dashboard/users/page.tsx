import { redirect } from "next/navigation";

export default async function LegacyUsersPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
    const { tab } = await searchParams;
    redirect(tab === "companies" ? "/dashboard/external-network" : "/dashboard/organization");
}
