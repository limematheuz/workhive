import type { LocationCatalog, LocationSpace } from "../../types/location.ts";

export function spaceFeatureKey(templateId:string,featureId:string) {
    return `feature_${templateId.slice(0,24)}_${featureId.slice(0,40)}`;
}

export function selectedLocationFeatureLabels(catalog: LocationCatalog | null, attributes: Record<string, boolean | number | string>): string[] {
    const labels = new Set<string>();
    for (const template of catalog?.space_library || []) {
        for (const feature of template.features) {
            if (attributes[spaceFeatureKey(template.id, feature.id)] === true) labels.add(`${template.label}: ${feature.label}`);
        }
    }
    return [...labels];
}

export function tasksForLocationSpace(catalog:LocationCatalog|null,space:LocationSpace|undefined) {
    if(!space)return [];
    const library=catalog?.space_library||catalog?.site_types.flatMap(site=>site.space_templates||[])||[];
    const template=library.find(item=>item.id===space.attributes?.catalog_template)||library.find(item=>item.space_type===space.space_type);
    if(!template)return [];
    const seen=new Set<string>();
    return [...template.tasks.map(title=>({title,category:/desinfect/i.test(title)?"disinfection":/reponer|sábanas|ropa de cama/i.test(title)?"restocking":"cleaning",condition:""})),...template.features.flatMap(feature=>feature.tasks.map(title=>({title,category:"optional",condition:feature.label})))].filter(task=>{
        const key=task.title.trim().toLocaleLowerCase().replace(/[.\s]+$/u,"");
        if(seen.has(key))return false;
        seen.add(key);return true;
    });
}
