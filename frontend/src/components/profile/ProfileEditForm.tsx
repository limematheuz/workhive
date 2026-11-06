"use client";

import React, { useState } from "react";
import { User } from "@/types/user";
import { User as UserIcon, Lock, Building2 } from "lucide-react";
import { ProfileDetailsForm } from "./ProfileDetailsForm";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { EmailChangeForm } from "./EmailChangeForm";
import { CompanyDetailsForm } from "./CompanyDetailsForm";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import type { Dictionary } from "@/lib/dictionary-context";

interface ProfileEditFormProps {
    user: User;
    dict: Dictionary;
    onCancel: () => void;
    onSuccess: () => Promise<void>;
}

export function ProfileEditForm({ user, dict, onCancel, onSuccess }: ProfileEditFormProps) {
    const [subTab, setSubTab] = useState<"details" | "password" | "company">("details");

    const isCompanyAdmin = user.role?.name === "admin" || user.role?.name === "superadmin";

    return (
        <div className="relative z-10 w-full space-y-4">
            <PremiumTabs
                tabs={[
                    {
                        id: "details" as const,
                        label: (
                            <>
                                <span className="hidden sm:inline">{dict.profile.editor_tabs.personal}</span>
                                <span className="sm:hidden">{dict.profile.editor_tabs.personal_short}</span>
                            </>
                        ),
                        icon: UserIcon
                    },
                    ...(isCompanyAdmin
                        ? [
                              {
                                  id: "company" as const,
                                  label: (
                                      <>
                                          <span className="hidden sm:inline">{dict.profile.editor_tabs.company}</span>
                                          <span className="sm:hidden">{dict.profile.editor_tabs.company_short}</span>
                                      </>
                                  ),
                                  icon: Building2
                              }
                          ]
                        : []),
                    {
                        id: "password" as const,
                        label: (
                            <>
                                <span className="hidden sm:inline">{dict.profile.editor_tabs.security}</span>
                                <span className="sm:hidden">{dict.profile.editor_tabs.security_short}</span>
                            </>
                        ),
                        icon: Lock
                    }
                ]}
                activeTab={subTab}
                onChange={setSubTab}
            />

            {subTab === "details" ? (
                <ProfileDetailsForm
                    user={user}
                    dict={dict}
                    onCancel={onCancel}
                    onSuccess={onSuccess}
                />
            ) : subTab === "company" ? (
                <CompanyDetailsForm
                    user={user}
                    dict={dict}
                    onCancel={onCancel}
                    onSuccess={onSuccess}
                />
            ) : (
                <div className="space-y-3">
                    <EmailChangeForm user={user} dict={dict} />
                    <PasswordChangeForm
                        user={user}
                        dict={dict}
                        onCancel={onCancel}
                        onSuccess={onSuccess}
                    />
                </div>
            )}
        </div>
    );
}
