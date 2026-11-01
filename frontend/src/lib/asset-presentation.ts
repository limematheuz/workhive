import type { LocationEquipmentStatus } from "@/types/location";

export const assetStatusLabel: Record<LocationEquipmentStatus, string> = {
    active: "Activo", maintenance: "Mantenimiento", retired: "Retirado",
};
