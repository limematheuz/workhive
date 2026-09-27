"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/dictionary-context";

interface TasksListPaginationProps {
    dict: Dictionary;
    itemsPerPage: number;
    safeCurrentPage: number;
    currentPage: number;
    totalItems: number;
    totalPages: number;
    pageNumbers: (number | string)[];
    setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export function TasksListPagination({
    dict,
    itemsPerPage,
    safeCurrentPage,
    currentPage,
    totalItems,
    totalPages,
    pageNumbers,
    setCurrentPage,
}: TasksListPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t border-[var(--border-soft)] text-xs text-[var(--text-muted)] font-semibold">
            <div>
                {dict.tasks?.pagination_info || "Showing"} {(safeCurrentPage - 1) * itemsPerPage + 1} - {Math.min(safeCurrentPage * itemsPerPage, totalItems)} of {totalItems} {dict.tasks?.pagination_tasks || "tasks"}
            </div>
            <div className="flex items-center gap-1">
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 font-bold"
                >
                    {dict.tasks?.prev_page || "Previous"}
                </Button>

                {pageNumbers.map((p, idx) => {
                    if (p === "...") {
                        const previousPage = pageNumbers[idx - 1];
                        const ellipsisKey = typeof previousPage === "number" && previousPage < currentPage ? "ellipsis-before-current" : "ellipsis-after-current";
                        return <span key={ellipsisKey} className="px-1.5 text-[var(--text-muted)]">...</span>;
                    }
                    return (
                        <Button
                            key={p}
                            type="button"
                            variant={safeCurrentPage === p ? "default" : "outline"}
                            size="xs"
                            onClick={() => setCurrentPage(p as number)}
                            className="px-3 py-1.5 font-bold"
                        >
                            {p}
                        </Button>
                    );
                })}

                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 font-bold"
                >
                    {dict.tasks?.next_page || "Next"}
                </Button>
            </div>
        </div>
    );
}
