import type { ReactNode } from "react";
import { ApplicationSession } from "@/components/applications/ApplicationSession";

export const metadata = { title: "Portal de cliente · WorkHive" };

export default function PortalLayout({ children }: { children: ReactNode }) {
    return <ApplicationSession kind="client">{children}</ApplicationSession>;
}
