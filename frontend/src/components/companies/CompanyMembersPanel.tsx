import { ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { groupCompanyMembers, type CompanyMember } from "./company-members";

type CompanyMembersPanelProps = {
    members: CompanyMember[];
    labels: {
        admins: string;
        workers: string;
        noAdmins: string;
        noWorkers: string;
        inactive: string;
    };
};

export function CompanyMembersPanel({ members, labels }: CompanyMembersPanelProps) {
    const { admins, workers } = groupCompanyMembers(members);

    return (
        <div className="billing-block grid gap-3 rounded-2xl border border-[var(--border-soft)] p-3.5 md:grid-cols-2">
            <MemberGroup
                title={labels.admins}
                members={admins}
                emptyLabel={labels.noAdmins}
                inactiveLabel={labels.inactive}
                icon={<ShieldCheck className="h-3.5 w-3.5 text-accent" />}
            />
            <MemberGroup
                title={labels.workers}
                members={workers}
                emptyLabel={labels.noWorkers}
                inactiveLabel={labels.inactive}
                icon={<UserRound className="h-3.5 w-3.5 text-accent" />}
            />
        </div>
    );
}

function MemberGroup({
    title,
    members,
    emptyLabel,
    inactiveLabel,
    icon,
}: {
    title: string;
    members: CompanyMember[];
    emptyLabel: string;
    inactiveLabel: string;
    icon: React.ReactNode;
}) {
    return (
        <section>
            <h3 className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {icon}
                {title} ({members.length})
            </h3>
            {members.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">{emptyLabel}</p>
            ) : (
                <ul className="space-y-2">
                    {members.map((member) => (
                        <li key={member.id} className="flex items-start justify-between gap-3 text-xs">
                            <div className="min-w-0">
                                <p className="truncate font-semibold text-[var(--text-main)]">
                                    {member.full_name || member.email}
                                </p>
                                <p className="truncate text-[var(--text-muted)]">{member.email}</p>
                            </div>
                            {!member.is_active && (
                                <Badge variant="outline" className="shrink-0 border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-muted)]">
                                    {inactiveLabel}
                                </Badge>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
