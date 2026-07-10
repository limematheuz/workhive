import type { Dictionary } from "@/lib/dictionary-context";
import type { Company } from "@/types/company";
import type { Location } from "@/types/location";

import { ReservationFormCleaningSection } from "./ReservationFormCleaningSection";
import { ReservationFormMainFields } from "./ReservationFormMainFields";
import { ReservationFormNotesSection } from "./ReservationFormNotesSection";
import type { ReservationFormState } from "./types";

type ReservationFormFieldsProps = {
    form: ReservationFormState;
    onFormChange: (form: ReservationFormState) => void;
    locations: Location[];
    serviceProviders: Company[];
    dict: Dictionary;
};

export function ReservationFormFields({
    form,
    onFormChange,
    locations,
    serviceProviders,
    dict,
}: ReservationFormFieldsProps) {
    return (
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
            <ReservationFormMainFields
                form={form}
                onFormChange={onFormChange}
                locations={locations}
                dict={dict}
            />

            <ReservationFormCleaningSection
                form={form}
                onFormChange={onFormChange}
                serviceProviders={serviceProviders}
                dict={dict}
            />

            <ReservationFormNotesSection
                form={form}
                onFormChange={onFormChange}
                dict={dict}
            />
        </div>
    );
}
