"use client";

import { Building2, Network, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { CollaborationControlCenter } from "@/components/collaborations/CollaborationControlCenter";
import { ExternalAccessControlCenter } from "@/components/organization/ExternalAccessControlCenter";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs, type TabOption } from "@/components/ui/premium-tabs";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";

type ExternalNetworkTab = "operations" | "professionals";

export function ExternalNetworkControlCenter() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const isCompanyAdmin = user?.role?.name === "admin" && Boolean(user.company_id);
    const canShowProfessionalAccess = userLoading || isCompanyAdmin;
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeTab: ExternalNetworkTab = canShowProfessionalAccess && searchParams.get("tab") === "professionals" ? "professionals" : "operations";

    const tabs: TabOption<ExternalNetworkTab>[] = [
        { id: "operations", label: dict.external_network.operational_tab, compactLabel: dict.external_network.operational_tab_compact, icon: Building2 },
        ...(canShowProfessionalAccess ? [{ id: "professionals" as const, label: dict.external_network.professional_tab, compactLabel: dict.external_network.professional_tab_compact, icon: ShieldCheck }] : []),
    ];

    const changeTab = (tab: ExternalNetworkTab) => {
        if (tab === "professionals" && !userLoading && !isCompanyAdmin) return;
        router.replace(tab === "operations" ? "/dashboard/external-network" : "/dashboard/external-network?tab=professionals");
    };

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader icon={Network} title={dict.external_network.title} subtitle={dict.external_network.subtitle} className="mb-7" />
            <PremiumTabs tabs={tabs} activeTab={activeTab} onChange={changeTab} mobileLabel={dict.external_network.mobile_tab_label} className="mb-6" />
            {activeTab === "operations" ? <CollaborationControlCenter embedded /> : <ExternalAccessControlCenter embedded />}
        </div>
    );
}
