import { redirect } from "next/navigation";

export default function ExternalAccessPage() {
    redirect("/dashboard/external-network?tab=professionals");
}
