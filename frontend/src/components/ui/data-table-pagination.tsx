"use client";

import { useMemo, useState } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DataTablePaginationProps = {
    page: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    summary: string;
    rowsPerPageLabel: string;
    previousLabel: string;
    nextLabel: string;
};

export function useDataTablePagination<T>(items: T[], pageSize = 20) {
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(pageSize);
    const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const pageItems = useMemo(
        () => items.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage),
        [items, rowsPerPage, safePage],
    );

    return {
        page: safePage,
        setPage,
        pageItems,
        pageSize: rowsPerPage,
        setPageSize: (nextPageSize: number) => {
            setRowsPerPage(nextPageSize);
            setPage(1);
        },
    };
}

export function DataTablePagination({ page, totalItems, pageSize, onPageChange, onPageSizeChange, summary, rowsPerPageLabel, previousLabel, nextLabel }: DataTablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    if (totalItems <= 20) return null;
    return (
        <footer className="flex flex-col gap-3 border-t border-[var(--border-soft)] px-5 py-3 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
                <p>{summary}</p>
                <div className="flex items-center gap-2">
                    <Label htmlFor="table-rows-per-page" className="text-xs font-medium text-[var(--text-muted)]">{rowsPerPageLabel}</Label>
                    <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
                        <SelectTrigger id="table-rows-per-page" className="h-8 w-18 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent align="start">{[10, 25, 50, 100].map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>
            <Pagination className="mx-0 w-auto sm:ml-auto">
                <PaginationContent>
                    <PaginationItem><PaginationPrevious disabled={safePage === 1} onClick={() => onPageChange(safePage - 1)} aria-label={previousLabel} /></PaginationItem>
                    <PaginationItem><PaginationNext disabled={safePage === totalPages} onClick={() => onPageChange(safePage + 1)} aria-label={nextLabel} /></PaginationItem>
                </PaginationContent>
            </Pagination>
        </footer>
    );
}
