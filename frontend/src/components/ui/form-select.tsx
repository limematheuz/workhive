"use client";

import type { ReactNode } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SelectField } from "@/components/ui/select-field";
import { formSelectOptions } from "@/lib/form-select-options";

export type FormSelectProps = {
    children: ReactNode; value: string | number; onValueChange: (value: string) => void;
    "aria-label"?: string; id?: string; name?: string; required?: boolean; disabled?: boolean;
    className?: string; searchable?: boolean; placeholder?: string;
};
export function FormSelect({ children, value, onValueChange, "aria-label": label, id, name, required, disabled, className, searchable, placeholder }: FormSelectProps) {
    const options = formSelectOptions(children);
    const entity = /client|cliente|location|ubicaci|centro|trabajador|worker|empleado|employee|proveedor|supplier|empresa|company|equipo|crew|responsable|assignee|material|almacen|almacén|warehouse|activo|asset|veh[ií]culo|vehicle|contrato|contract|servicio|service/.test(`${label ?? ""} ${id ?? ""} ${name ?? ""}`.toLocaleLowerCase());
    const props = { options, value: String(value), onValueChange, "aria-label": label ?? placeholder ?? "Seleccionar opción", id, name, required, disabled, className, placeholder };
    return (searchable ?? (entity || options.length > 8)) ? <SearchableSelect {...props} /> : <SelectField {...props} />;
}
