import {
    Building2,
    CarFront,
    Factory,
    Hammer,
    Home,
    Hotel,
    Landmark,
    MapPin,
    School,
    Stethoscope,
    Store,
    type LucideIcon,
} from "lucide-react";

interface LocationTypeVisual {
    icon: LucideIcon;
    className: string;
}

const VISUALS: Record<string, LocationTypeVisual> = {
    office: { icon: Building2, className: "bg-violet-500/10 text-violet-600" },
    community: { icon: Building2, className: "bg-emerald-500/10 text-emerald-600" },
    tourist_apartment: { icon: Home, className: "bg-amber-500/10 text-amber-600" },
    private_home: { icon: Home, className: "bg-sky-500/10 text-sky-600" },
    house: { icon: Home, className: "bg-sky-500/10 text-sky-600" },
    hotel: { icon: Hotel, className: "bg-orange-500/10 text-orange-600" },
    restaurant: { icon: Store, className: "bg-rose-500/10 text-rose-600" },
    cafe: { icon: Store, className: "bg-rose-500/10 text-rose-600" },
    commercial: { icon: Store, className: "bg-amber-500/10 text-amber-600" },
    clinic: { icon: Stethoscope, className: "bg-cyan-500/10 text-cyan-600" },
    dental_clinic: { icon: Stethoscope, className: "bg-cyan-500/10 text-cyan-600" },
    school: { icon: School, className: "bg-blue-500/10 text-blue-600" },
    nursery: { icon: School, className: "bg-pink-500/10 text-pink-600" },
    industrial: { icon: Factory, className: "bg-slate-500/10 text-slate-600" },
    warehouse: { icon: Factory, className: "bg-slate-500/10 text-slate-600" },
    parking: { icon: CarFront, className: "bg-indigo-500/10 text-indigo-600" },
    public_building: { icon: Landmark, className: "bg-fuchsia-500/10 text-fuchsia-600" },
    construction: { icon: Hammer, className: "bg-orange-500/10 text-orange-600" },
};

const FALLBACK_VISUAL: LocationTypeVisual = {
    icon: MapPin,
    className: "bg-accent/10 text-accent",
};

export function getLocationTypeVisual(siteType?: string | null): LocationTypeVisual {
    return (siteType && VISUALS[siteType]) || FALLBACK_VISUAL;
}
