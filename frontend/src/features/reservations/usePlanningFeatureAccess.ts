import { useEffect, useState } from "react";

import { CompanyPlanAccessService } from "@/services/company-plan-access.service";
import type { User } from "@/types/user";

export function usePlanningFeatureAccess(user: User | null) {
    const [planningEnabled, setPlanningEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        if (!user?.company_id) return;
        let cancelled = false;
        void CompanyPlanAccessService.getCurrentEntitlements()
            .then((access) => {
                if (cancelled) return;
                setPlanningEnabled(
                    access.entitlements.some(
                        (entitlement) =>
                            entitlement.code === "features.planning"
                            && entitlement.value_type === "boolean"
                            && entitlement.value === true,
                    ),
                );
            })
            .catch(() => {
                if (!cancelled) setPlanningEnabled(false);
            });
        return () => {
            cancelled = true;
        };
    }, [user?.company_id]);

    return {
        planningEnabled,
        hasPlanningAccess: user?.company_id ? planningEnabled : false,
    };
}
