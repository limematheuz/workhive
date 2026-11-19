import type { ReactNode } from "react";
import { ApplicationSession } from "@/components/applications/ApplicationSession";

export const metadata = { title: "Portal de gestoría · WorkHive" };

export default function PortalLayout({ children }: { children: ReactNode }) {
    return <ApplicationSession kind="adviser">{children}</ApplicationSession>;
}
