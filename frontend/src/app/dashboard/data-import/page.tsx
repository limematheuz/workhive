"use client";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DataImportWorkspace } from "@/components/onboarding/DataImportWorkspace";
export default function DataImportPage() {
    return <div className="dashboard-page-content space-y-3"><PageHeader icon={Upload} title="Importar clientes y trabajadores" subtitle="Libros XLSX y archivos CSV de hasta 500 registros y 2 MB." /><DataImportWorkspace /></div>;
}
