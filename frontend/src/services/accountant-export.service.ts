import {
    accountantExportFilename,
    accountantExportPath,
    type AccountantExportPeriod,
} from "@/lib/accountant-export";
import { apiFetch, extractErrorMessage } from "@/lib/api";


export const AccountantExportService = {
    downloadForAccountant: async (
        year: number,
        period: AccountantExportPeriod = "year",
        periodNumber?: number,
    ): Promise<void> => {
        const response = await apiFetch(accountantExportPath(year, period, periodNumber), {
            cache: "no-store",
        });
        if (!response.ok) {
            throw new Error(
                await extractErrorMessage(response, "Could not export accountant package"),
            );
        }

        const disposition = response.headers.get("Content-Disposition") || "";
        const filename = disposition.match(/filename="([^\"]+)"/)?.[1]
            || accountantExportFilename(year, period, periodNumber);
        const objectUrl = URL.createObjectURL(await response.blob());
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
    },
};
