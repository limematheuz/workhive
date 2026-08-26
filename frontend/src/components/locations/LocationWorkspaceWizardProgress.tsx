import { WizardProgress } from "@/components/ui/wizard-progress";
import { useDictionary } from "@/lib/dictionary-context";

interface LocationWorkspaceWizardProgressProps {
    step: number;
}

export function LocationWorkspaceWizardProgress({ step }: LocationWorkspaceWizardProgressProps) {
    const { dict } = useDictionary();
    const workspace = dict.locations.workspace;
    return <WizardProgress
        step={step}
        steps={[workspace.step_info_access, workspace.step_type, workspace.step_features, workspace.step_spaces_tasks]}
        ariaLabel={workspace.wizard_progress}
    />;
}
