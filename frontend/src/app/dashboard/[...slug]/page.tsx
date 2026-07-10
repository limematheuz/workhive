import { notFound } from "next/navigation";

/**
 * Routes under /dashboard/* without their own page.tsx (tasks, invoices, profile, etc.)
 * trigger notFound() within the dashboard segment, preserving the layout and sidebar.
 */
export default function DashboardUnknownRoute() {
    notFound();
}
