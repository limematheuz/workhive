import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PublicLanding } from "@/components/marketing/PublicLanding";
import { isPublicSiteHost, PUBLIC_SITE_METADATA } from "@/lib/public-site";

export const metadata = PUBLIC_SITE_METADATA;

export default async function Home() {
    const host = (await headers()).get("host");

    if (isPublicSiteHost(host)) {
        return <PublicLanding />;
    }

    redirect("/login");
}
