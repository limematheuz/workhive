import type { ReactNode } from "react";
import type { LocationAccessDraft } from "./location-workspace-types";

/** Read-only presentation; access codes are always masked. */
export function LocationAccessSummary({ access, hours, hasAccessCode, action }: {
    access: LocationAccessDraft;
    hours: string;
    hasAccessCode?: boolean;
    action?: ReactNode;
}) {
    return <section className="wh-panel">
        <div className="wh-summary-section-heading"><h4 className="wh-panel-title">Acceso y horario</h4>{action}</div>
        <dl className="wh-facts">
            <div><dt>Horario permitido</dt><dd>{hours || "Sin horario definido"}</dd></div>
            <div><dt>Método de acceso</dt><dd>{access.access_method || "Sin indicar"}</dd></div>
            <div><dt>Llaves</dt><dd>{access.keys_available == null ? "Sin indicar" : access.keys_available ? "Disponibles" : "No disponibles"}</dd></div>
            <div><dt>Código de acceso</dt><dd>{access.clear_access_code ? "Se eliminará al guardar" : access.access_code || hasAccessCode ? "••••••" : "Sin configurar"}</dd></div>
        </dl>
        {access.instructions && <p className="wh-access-instructions">{access.instructions}</p>}
        <details className="wh-summary-details">
            <summary>Custodia de llaves y detalles</summary>
            <dl className="wh-facts mt-3">
                <div><dt>Dónde se guardan las llaves</dt><dd>{access.keys_location || "Sin indicar"}</dd></div>
                <div><dt>Persona que custodia las llaves</dt><dd>{access.key_custodian || "Sin indicar"}</dd></div>
            </dl>
            {!access.instructions && <p className="mt-2 text-xs text-[var(--text-muted)]">Sin instrucciones adicionales.</p>}
        </details>
    </section>;
}
