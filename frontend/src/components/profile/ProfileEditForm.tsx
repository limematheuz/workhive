"use client";

import React, { useState } from "react";
import { User } from "@/types/user";
import { User as UserIcon, Lock, Building2 } from "lucide-react";
import { ProfileDetailsForm } from "./ProfileDetailsForm";
import { PasswordChangeForm } from "./PasswordChangeForm";
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
        <div className="space-y-6 w-full relative z-10">
            {/* Sub-tab switcher */}
            <PremiumTabs
                tabs={[
                    {
                        id: "details" as const,
                        label: (
                            <>
                                <span className="hidden sm:inline">Datos Personales</span>
                                <span className="sm:hidden">Personal</span>
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
                                          <span className="hidden sm:inline">Datos de la Empresa</span>
                                          <span className="sm:hidden">Empresa</span>
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
                                <span className="hidden sm:inline">Seguridad y Contraseña</span>
                                <span className="sm:hidden">Seguridad</span>
                            </>
                        ),
                        icon: Lock
                    }
                ]}
                activeTab={subTab}
                onChange={setSubTab}
                className="mb-6"
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
                <PasswordChangeForm
                    user={user}
                    dict={dict}
                    onCancel={onCancel}
                    onSuccess={onSuccess}
                />
            )}
        </div>
    );
}
