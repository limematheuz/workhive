import { ExternalNetworkControlCenter } from "@/components/external-network/ExternalNetworkControlCenter";
import { Suspense } from "react";

export default function ExternalNetworkPage() {
    return <Suspense><ExternalNetworkControlCenter /></Suspense>;
}
