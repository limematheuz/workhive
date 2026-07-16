import { ShieldCheck, UserRound } from "lucide-react";

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
        <div className="glass-panel grid gap-4 rounded-xl p-4 md:grid-cols-2">
            <MemberGroup
                title={labels.admins}
                members={admins}
                emptyLabel={labels.noAdmins}
                inactiveLabel={labels.inactive}
                icon={<ShieldCheck className="h-4 w-4 text-accent" />}
            />
            <MemberGroup
                title={labels.workers}
                members={workers}
                emptyLabel={labels.noWorkers}
                inactiveLabel={labels.inactive}
                icon={<UserRound className="h-4 w-4 text-accent" />}
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
            <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--text-main)]">
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
                                <span className="shrink-0 rounded-full bg-[var(--bg-tertiary)] px-2 py-0.5 text-2xs font-bold text-[var(--text-muted)]">
                                    {inactiveLabel}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
