import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useDictionary } from "@/lib/dictionary-context";

export function WorkspaceOverview() {
    const { dict } = useDictionary();
    return (
        <div className="space-y-6 p-6">
            <PageHeader icon={LayoutDashboard} title={dict.dashboard.workspace_title}
                subtitle={dict.dashboard.workspace_description} />
            <Button asChild variant="outline">
                <Link href="/dashboard/profile">{dict.dashboard.view_profile}</Link>
            </Button>
        </div>
    );
}
