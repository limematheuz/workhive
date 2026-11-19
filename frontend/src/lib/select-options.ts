export type SelectOption = { value: string; label: string; description?: string; disabled?: boolean };

function searchText(value: string) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}
export function searchSelectOptions(options: readonly SelectOption[], query: string, maxResults = 40) {
    const terms = searchText(query).split(/\s+/).filter(Boolean);
    const matches = options.filter(option => {
        const text = searchText(`${option.label} ${option.description ?? ""}`);
        return terms.every(term => text.includes(term));
    });
    const limit = Math.max(1, Math.min(100, Math.floor(maxResults) || 40));
    return { items: matches.slice(0, limit), total: matches.length, hasMore: matches.length > limit };
}
export function nextSelectableIndex(options: readonly SelectOption[], current: number, direction: 1 | -1) {
    if (!options.length) return -1;
    let index = current >= 0 && current < options.length ? current : direction === 1 ? -1 : 0;
    for (let step = 0; step < options.length; step++) {
        index = (index + direction + options.length) % options.length;
        if (!options[index].disabled) return index;
    }
    return -1;
}
