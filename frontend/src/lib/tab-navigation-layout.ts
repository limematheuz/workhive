export function tabLimitForViewport(width: number): number {
    if (width >= 1024) return 6;
    return 0;
}

export function shouldCollapseTabs({ count, viewportWidth, availableWidth, requiredWidth }: {
    count: number; viewportWidth: number; availableWidth: number; requiredWidth: number;
}): boolean {
    return count > tabLimitForViewport(viewportWidth) || requiredWidth > availableWidth + 1;
}
