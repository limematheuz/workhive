"use client";

import { DocumentFormSection } from "@/components/billing/DocumentFormSection";
import { QuoteItemsTable } from "@/components/quotes/QuoteItemsTable";
import type { ConceptRow } from "@/hooks/useQuoteForm";
import type { Dictionary } from "@/lib/dictionary-context";

type QuoteFormLinesSectionProps = {
    concepts: ConceptRow[];
    dict: Dictionary;
    handleAddManualRow: () => void;
    handleDuplicateRow: (id: string) => void;
    handleUpdateRow: <Field extends keyof ConceptRow>(
        id: string,
        field: Field,
        value: ConceptRow[Field],
    ) => void;
    handleDeleteRow: (id: string) => void;
    pricesIncludeTax: boolean;
};

export function QuoteFormLinesSection({
    concepts,
    dict,
    handleAddManualRow,
    handleDuplicateRow,
    handleUpdateRow,
    handleDeleteRow,
    pricesIncludeTax,
}: QuoteFormLinesSectionProps) {
    return (
        <DocumentFormSection
            title={dict.quotes?.concepts_title || "Conceptos del presupuesto"}
            description="Añade líneas con descripción, precio y cantidad."
        >
            <QuoteItemsTable
                concepts={concepts}
                dict={dict}
                handleAddManualRow={handleAddManualRow}
                handleDuplicateRow={handleDuplicateRow}
                handleUpdateRow={handleUpdateRow}
                handleDeleteRow={handleDeleteRow}
                pricesIncludeTax={pricesIncludeTax}
                embedded
            />
        </DocumentFormSection>
    );
}
