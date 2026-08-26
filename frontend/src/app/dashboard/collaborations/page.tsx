import { redirect } from "next/navigation";

export default function LegacyCollaborationsPage() {
    redirect("/dashboard/users?tab=companies");
}
