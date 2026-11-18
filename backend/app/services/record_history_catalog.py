"""Explicit audit fields: credentials, addresses, free notes and files never enter history."""
TRACKED = {
    "clients": ("client", ("name", "client_type", "relationship_status", "is_active", "city", "country")),
    "locations": ("location", ("name", "city", "location_type", "is_active", "client_id", "department_id", "team_id")),
    "staff_employees": ("staff_employee", ("name", "position", "team", "monthly_hours", "hourly_cost")),
    "quotes": ("quote", ("title", "status", "valid_until", "base_amount", "tax_amount", "total_amount", "tax_rate", "discount", "revision_number")),
    "service_contracts": ("service_contract", ("title", "status", "starts_at", "ends_at", "renewal_mode", "renewal_notice_days", "response_time_hours", "resolution_time_hours", "service_window")),
    "work_orders": ("work_order", ("title", "status", "order_type", "scheduled_start_at", "next_occurrence_at", "recurrence_unit", "recurrence_interval", "recurrence_ends_at", "estimated_people", "estimated_minutes")),
    "task_items": ("task_item", ("title", "status", "priority", "scheduled_start_at", "due_at", "user_id", "location_id", "price", "quantity", "date_done")),
    "staff_shifts": ("staff_shift", ("employee_id", "location_id", "task_id", "starts_at", "ends_at")),
    "staff_absences": ("staff_absence", ("employee_id", "substitute_id", "starts_on", "ends_on", "kind")),
    "invoices": ("invoice", ("invoice_number", "status", "issue_date", "due_date", "base_amount", "tax_amount", "total_amount", "discount", "payment_method", "is_active", "paid_at")),
    "expenses": ("expense", ("expense_date", "vendor", "category", "base_amount", "tax_amount", "total_amount", "payment_method", "client_id", "service_contract_id", "work_order_id", "is_active")),
    "company_memberships": ("company_membership", ("access_class", "status", "permissions_configured", "started_at", "ended_at")),
    "permission_profiles": ("permission_profile", ("name", "is_active")),
}
PROFILE_FIELDS = ("state", "contract", "gross", "extra", "bonus", "insurance", "other")
FINANCIAL_FIELDS = frozenset(("price", "quantity", "base_amount", "tax_amount", "total_amount", "tax_rate", "discount"))
LABOR_FIELDS = frozenset(("monthly_hours", "hourly_cost", "profile.gross", "profile.extra", "profile.bonus", "profile.insurance", "profile.other"))
LABELS = {
    "workforce_scope":"Espacios, tareas y personal asignado",
    "name":"Nombre", "title":"Nombre", "client_type":"Tipo de cliente", "relationship_status":"Relación comercial", "is_active":"Activo", "city":"Ciudad", "country":"País",
    "location_type":"Tipo de centro", "client_id":"Cliente", "department_id":"Delegación", "team_id":"Área", "position":"Cargo", "team":"Equipo", "monthly_hours":"Horas contratadas al mes", "hourly_cost":"Coste por hora",
    "status":"Estado", "priority":"Prioridad", "valid_until":"Validez", "base_amount":"Base", "tax_amount":"Impuestos", "total_amount":"Total", "tax_rate":"Tipo de impuesto", "discount":"Descuento", "revision_number":"Revisión",
    "starts_at":"Inicio", "ends_at":"Fin", "starts_on":"Desde", "ends_on":"Hasta", "renewal_mode":"Renovación", "renewal_notice_days":"Preaviso", "response_time_hours":"Respuesta SLA", "resolution_time_hours":"Resolución SLA", "service_window":"Ventana de servicio",
    "order_type":"Tipo de trabajo", "scheduled_start_at":"Inicio previsto", "due_at":"Fin previsto", "next_occurrence_at":"Próxima ejecución", "recurrence_unit":"Frecuencia", "recurrence_interval":"Intervalo", "recurrence_ends_at":"Fin de recurrencia", "estimated_people":"Personas previstas", "estimated_minutes":"Minutos previstos",
    "user_id":"Acceso asignado", "employee_id":"Trabajador", "substitute_id":"Sustituto", "location_id":"Centro", "task_id":"Trabajo", "task_item_id":"Trabajo generado", "price":"Precio", "quantity":"Cantidad", "date_done":"Finalización", "kind":"Tipo",
    "profile":"Perfil", "profile.state":"Estado del trabajador", "profile.contract":"Contrato laboral", "profile.gross":"Salario bruto", "profile.extra":"Pagas extra", "profile.bonus":"Complementos", "profile.insurance":"Cargas sociales", "profile.other":"Otros costes",
    "invoice_number":"Número de factura", "issue_date":"Fecha de emisión", "due_date":"Vencimiento", "paid_at":"Fecha de cobro", "expense_date":"Fecha del gasto", "vendor":"Proveedor", "category":"Categoría", "payment_method":"Forma de pago", "service_contract_id":"Contrato", "work_order_id":"Programación",
    "access_class":"Clase de acceso", "permissions_configured":"Permisos configurados", "started_at":"Alta de acceso", "ended_at":"Fin de acceso", "permission_codes":"Permisos", "profile_assignments":"Perfiles y ámbitos asignados",
}
