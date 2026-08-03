"use client";

import React from "react";
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
                <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed ui-motion cursor-pointer font-bold"
                >
                    {dict.tasks?.prev_page || "Previous"}
                </button>

                {pageNumbers.map((p, idx) => {
                    if (p === "...") {
                        const previousPage = pageNumbers[idx - 1];
                        const ellipsisKey = typeof previousPage === "number" && previousPage < currentPage ? "ellipsis-before-current" : "ellipsis-after-current";
                        return <span key={ellipsisKey} className="px-1.5 text-[var(--text-muted)]">...</span>;
                    }
                    return (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setCurrentPage(p as number)}
                            className={`px-3 py-1.5 rounded-xl border ui-motion cursor-pointer font-bold ${
                                safeCurrentPage === p
                                    ? "bg-accent border-accent text-white animate-none"
                                    : "bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-secondary)]"
                            }`}
                        >
                            {p}
                        </button>
                    );
                })}

                <button
                    type="button"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed ui-motion cursor-pointer font-bold"
                >
                    {dict.tasks?.next_page || "Next"}
                </button>
            </div>
        </div>
    );
}
