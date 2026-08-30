import * as React from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
    return (
        <nav
            data-slot="pagination"
            aria-label="Pagination"
            className={cn("mx-auto flex w-full justify-center", className)}
            {...props}
        />
    );
}

function PaginationContent({ className, ...props }: React.ComponentProps<"ul">) {
    return <ul data-slot="pagination-content" className={cn("flex flex-row items-center gap-1", className)} {...props} />;
}

function PaginationItem(props: React.ComponentProps<"li">) {
    return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
    isActive?: boolean;
} & React.ComponentProps<"a">;

function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
    return (
        <a
            data-slot="pagination-link"
            aria-current={isActive ? "page" : undefined}
            className={cn(
                buttonVariants({ variant: isActive ? "outline" : "ghost", size: "icon-sm" }),
                className,
            )}
            {...props}
        />
    );
}

type PaginationDirectionProps = React.ComponentProps<typeof PaginationLink> & {
    iconOnly?: boolean;
};

function PaginationPrevious({
    className,
    children = "Previous",
    iconOnly = false,
    ...props
}: PaginationDirectionProps) {
    return (
        <PaginationLink
            aria-label="Go to previous page"
            className={cn("gap-1 px-2.5", className)}
            {...props}
        >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            {!iconOnly && <span className="hidden sm:inline">{children}</span>}
        </PaginationLink>
    );
}

function PaginationNext({
    className,
    children = "Next",
    iconOnly = false,
    ...props
}: PaginationDirectionProps) {
    return (
        <PaginationLink
            aria-label="Go to next page"
            className={cn("gap-1 px-2.5", className)}
            {...props}
        >
            {!iconOnly && <span className="hidden sm:inline">{children}</span>}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </PaginationLink>
    );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span data-slot="pagination-ellipsis" aria-hidden="true" className={cn("flex h-8 w-8 items-center justify-center", className)} {...props}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More pages</span>
        </span>
    );
}

export {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
};
