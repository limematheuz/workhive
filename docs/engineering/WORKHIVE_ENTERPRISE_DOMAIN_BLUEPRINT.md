# WorkHive: arquitectura de dominio Enterprise y plan de evolución

> Estado: propuesta de arquitectura basada en la auditoría del 26 de agosto de
> 2026. Separa expresamente modelo actual, modelo objetivo y decisiones
> pendientes de aprobación. No autoriza todavía migraciones ni cambios de
> comportamiento.

## 1. Objetivo acordado

WorkHive debe ser una plataforma Enterprise para empresas de limpieza, servicios
y facility management. Debe servir desde una empresa pequeña hasta una
organización con departamentos, equipos, múltiples centros, servicios
recurrentes, control de calidad, inventario, facturación y rentabilidad real.

La aplicación completa existe en una sola base de producto. Los planes
comerciales limitan módulos y capacidad contratada; no se crean productos
distintos por plan.

Capacidades objetivo:

- Horas, minutos, pausas, correcciones, aprobaciones y coste laboral.
- Facturación por servicio, fijo, horas, materiales o contrato.
- Equipos con responsables, trabajadores, centros y material asignado.
- Departamentos: Comercial, RRHH, Operaciones, Calidad, Finanzas y otros.
- Permisos reales de backend: nadie recibe campos que no pueda consultar.
- Analítica por cliente, contrato, ubicación, servicio, equipo, departamento y
  trabajador.
- Calidad: inspecciones, evidencias, incidencias, reclamaciones y acciones
  correctivas.
- Planes Básico, Mediano, Top, Mega y A medida.
- UI con los componentes y patrones shadcn/ui del repositorio.

## 2. Principios no negociables

1. Multiempresa y mínimo privilegio. Todo dato se aísla por empresa y el
   frontend nunca actúa como autorización.
2. Permiso antes de datos. El backend decide leer, crear, editar, aprobar,
   exportar o mostrar datos sensibles.
3. Histórico inalterable. Facturas emitidas, registros fiscales, fichajes
   aprobados y versiones de contrato no se recalculan con datos actuales.
4. Dinero exacto. Las nuevas cantidades monetarias usan Decimal/Numeric, nunca
   coma flotante.
5. Migración segura. El patrón es expandir, migrar, verificar y contraer.
6. Capas separadas. Modelos persisten, schemas son contratos, repositorios
   consultan, servicios aplican negocio y rutas transportan HTTP.
7. Auditabilidad. Planes, permisos, precios, contratos, fichajes y calidad
   dejan evidencia.
8. DRY, KISS y SOLID. La complejidad del producto no justifica abstracciones
   sin uso ni aumentar módulos congelados.

## 3. Regla central de acceso

Una operación se permite solo cuando se cumplen las cuatro capas:

~~~
Suscripción de empresa activa
  + funcionalidad incluida en el plan
  + permiso del perfil de acceso
  + alcance sobre el dato solicitado
= operación permitida
~~~

Ejemplo: un supervisor de Calidad puede inspeccionar un centro solo si la
empresa tiene el módulo, su perfil permite crear inspecciones y su
equipo/departamento está asignado al centro. No ve facturas, precios ni margen
sin permiso adicional.

## 4. Estado técnico actual verificado

| Área | Resultado |
| --- | --- |
| Backend | FastAPI, SQLAlchemy, Alembic y PostgreSQL |
| Frontend | Next.js, TypeScript, Tailwind y shadcn local |
| Capas | Rutas → servicios → repositorios → base de datos |
| Pruebas backend | 492 aprobadas; 6 omitidas |
| Pruebas frontend | 486 aprobadas |
| Typecheck, lint y build | Aprobados |
| Guardas de arquitectura | Aprobadas |
| Pruebas de migración | Aprobadas |

Las pruebas E2E existen, pero no se ejecutaron en la auditoría: no había una URL
E2E ni datos demo accesibles. React Doctor no pudo instalarse porque pnpm
bloqueó una dependencia transitiva por una degradación de confianza. No se debe
eludir ese bloqueo.

Fortalezas reutilizables:

- Aislamiento por empresa en buena parte de servicios y repositorios.
- Facturas fiscales con snapshots, hash, rectificaciones y registros fiscales.
- Ubicaciones con perfil operativo, acceso cifrado y zonas jerárquicas.
- Trabajos con checklist estructurado, asignaciones y tiempo por trabajador.
- Calendario, reservas y colaboración externa ya separados del dominio central.
- Guardas contra SQL directo en rutas nuevas y HTTP directo desde frontend.

Brechas que obligan a cambiar el modelo:

- Roles codificados por nombre, sin departamentos, perfiles ni permisos
  configurables.
- Viewer puede leer clientes y Clientes aparece en la navegación operativa.
- No hay tablas de departamento, equipo, contrato, inventario, inspección,
  proveedor, cobro ni pago.
- La suscripción actual bloquea toda la empresa y limita usuarios activos, pero
  no funcionalidades ni cuotas por clase de plaza.
- TaskItem mezcla orden de trabajo, tarea y recurrencia.
- Los fichajes no incluyen pausa, GPS final, corrección, aprobación o coste.
- Presupuestos, gastos y tarifas usan Float en varias entidades.
- La rentabilidad no incorpora personal, material, subcontrata, contrato ni
  reparto de gasto.

## 5. Estructura actual de la base de datos

Esta es la fotografía real de los modelos registrados actualmente por Alembic
en backend/app/db/base.py. No representa aún el modelo Enterprise.

### 5.1 Diagrama relacional principal actual

~~~mermaid
erDiagram
    COMPANY ||--o{ USER : tiene
    ROLE ||--o{ USER : clasifica
    COMPANY ||--o{ CLIENT : posee
    CLIENT ||--o{ LOCATION : agrupa
    LOCATION ||--o| LOCATION_PROFILE : perfila
    LOCATION ||--o| LOCATION_ACCESS_PROFILE : protege
    LOCATION ||--o{ LOCATION_ZONE : contiene
    LOCATION ||--o{ TASK_ITEM : recibe
    TASK_ITEM ||--o{ TASK_ASSIGNMENT : asigna
    TASK_ITEM ||--o{ TASK_CHECKLIST_ITEM : desglosa
    TASK_CHECKLIST_ITEM ||--o{ TASK_CHECKLIST_ASSIGNMENT : asigna
    USER ||--o{ WORK_SESSION : ficha
    TASK_ITEM ||--o{ WORK_SESSION : registra
    LOCATION ||--o{ RESERVATION : reserva
    RESERVATION ||--o{ TASK_ITEM : origina
    COMPANY ||--o{ TEMPLATE_TASK : cataloga
    TEMPLATE_TASK ||--o{ TASK_ITEM : inspira
    CLIENT ||--o{ QUOTE : presupuesta
    QUOTE ||--o{ QUOTE_ITEM : contiene
    CLIENT ||--o{ INVOICE : factura
    INVOICE ||--o{ INVOICE_ITEM : contiene
    TASK_ITEM ||--o{ INVOICE_ITEM : facturable
    CLIENT ||--o{ EXPENSE : imputa
~~~

### 5.2 Tenencia, identidad, privacidad y plataforma

| Tabla / entidad | Responsabilidad | Relaciones de BBDD |
| --- | --- | --- |
| companies / Company | Empresa tenant, fiscal/banca, onboarding y suscripción básica. | Padre de users, clients, invoices, quotes, expenses, sales_ledger_records y template_tasks; referencia ubicaciones y reservas propias. |
| roles / Role | Catálogo global actual de roles. | users.role_id y user_invitations.role_id apuntan a roles. Roles activos: superadmin, admin, accountant, manager y viewer. |
| users / User | Credencial global, sesión, rol y una empresa actual. | role_id a roles; company_id a companies; referenciado por fichajes, trabajos, invitaciones, reservas, auditoría, privacidad y calendario. |
| user_invitations / UserInvitation | Invitación de persona a una empresa con rol. | company_id a companies, invited_by_user_id a users, role_id a roles. |
| trial_requests / TrialRequest | Solicitud pública de prueba y aprobación. | Referencias opcionales a usuario aprobador, empresa creada y usuario creado. |
| consumed_security_tokens / ConsumedSecurityToken | Previene reutilización de token. | No contiene FK de negocio; guarda identificador, propósito y expiración. |
| privacy_consents / PrivacyConsent | Consentimientos de privacidad. | Usuario y empresa asociados. |
| data_subject_requests / DataSubjectRequest | Solicitudes de derechos de privacidad. | Empresa, usuario solicitante y usuario resolutor. |
| audit_logs / AuditLog | Auditoría genérica de acción, entidad, actor, petición/IP y detalles JSON. | company_id a companies; actor_user_id a users. |
| notifications / Notification | Notificación persistente. | user_id a users y company_id a companies; entidad enlazada como tipo/id sin FK. |
| stripe_webhook_events / StripeWebhookEvent | Idempotencia/registro técnico de Stripe. | Identificador externo de evento, sin relación de dominio principal. |

Limitación: User contiene directamente una empresa y rol. No puede expresar
pertenencia, histórico de empleo, departamentos, perfiles de acceso o alcance
por equipo.

### 5.3 Clientes, comercial y finanzas actuales

| Tabla / entidad | Responsabilidad | Relaciones de BBDD |
| --- | --- | --- |
| clients / Client | Cliente básico: nombre, tipo, fiscal, dirección, teléfono, email y activo. | company_id a companies. Padre de locations, invoices, quotes y expenses. Identificador legal único por empresa cuando existe. |
| quotes / Quote | Presupuesto con estado, impuestos, importes, notas y emisor/destinatario. | company_id a companies; client_id a clients opcional; padre de quote_items. |
| quote_items / QuoteItem | Línea de presupuesto. | quote_id a quotes. No enlaza catálogo, contrato, ubicación ni trabajo. |
| invoices / Invoice | Factura con Numeric, snapshots, rectificación, PDF, Facturae y datos fiscales. | company_id a companies; client_id a clients; original_invoice_id a invoices; padre de invoice_items y fiscal_invoice_records. |
| invoice_items / InvoiceItem | Línea fiscal de cantidad, precio, impuesto, subtotal y total. | invoice_id a invoices; task_item_id a task_items opcional. |
| fiscal_invoice_records / FiscalInvoiceRecord | Registro fiscal con hash, payload y respuesta AEAT. | invoice_id a invoices y company_id a companies. |
| company_fiscal_settings / CompanyFiscalSettings | Ajuste fiscal/certificado cifrado por empresa. | company_id a companies, único: uno a uno lógico. |
| invoice_email_contacts / InvoiceEmailContact | Sugerencias de destinatarios de documentos. | company_id a companies. |
| expenses / Expense | Gasto con proveedor textual, categoría, comprobante y posible cliente. | company_id a companies; client_id a clients opcional; created_by_user_id a users. No enlaza ubicación, trabajo, contrato, equipo o material. |
| sales_ledger_records / SalesLedgerRecord | Venta histórica manual separada de facturas fiscales. | company_id a companies; cliente opcional según importación. |

Limitación: no hay contacto múltiple, oportunidad, contrato, tarifa, revisión de
presupuesto, cobro, pago parcial, proveedor normalizado, compra, centro de coste
ni reparto de gasto.

### 5.4 Ubicaciones, espacios y acceso actuales

| Tabla / entidad | Responsabilidad | Relaciones de BBDD |
| --- | --- | --- |
| locations / Location | Centro físico, dirección, coordenadas, tipo, campos legacy de vivienda, propietario/gestor y proveedor por defecto. | client_id a clients; managing_company_id, owner_company_id y default_service_provider_id a companies. Padre de perfiles, zonas, trabajos, reservas, fichajes y accesos compartidos. |
| location_profiles / LocationProfile | Perfil operativo: código interno, tipo de centro, contacto y atributos. | PK location_id a locations; company_id a companies. Uno a uno; código interno único por empresa. |
| location_access_profiles / LocationAccessProfile | Horarios, método, llaves, instrucciones y código cifrado. | PK location_id a locations; uno a uno. |
| location_zones / LocationZone | Jerarquía de zonas y espacios físicos. | location_id a locations; parent_id a location_zones. Padre de task_zones y location_space_task_templates. |
| task_zones / TaskZone | Snapshot de zonas elegidas para trabajo. | task_id a task_items y zone_id a location_zones; conserva nombre/tipo. |
| location_space_task_templates / LocationSpaceTaskTemplate | Tarea local por espacio: título, categoría, frecuencia y minutos estimados. | location_space_id a location_zones; puede ser referenciada por checklist. |
| location_templates / LocationTemplate | Plantilla global en ubicación con override. | PK compuesta location_id a locations y template_task_id a template_tasks. |
| location_company_access / LocationCompanyAccess | Compartición de un centro con empresa colaboradora. | PK compuesta location_id a locations y company_id a companies; capacidades de reserva, trabajo y datos sensibles. |

Limitación: una ubicación no conoce contrato, SLA, equipos internos, responsable,
documentación, riesgos, material, calidad ni coste imputado. Hay solapamiento
entre atributos de perfil y campos legacy.

### 5.5 Catálogo, reservas, trabajos, fichajes y reportes actuales

| Tabla / entidad | Responsabilidad | Relaciones de BBDD |
| --- | --- | --- |
| template_tasks / TemplateTask | Biblioteca actual por empresa: nombre, descripción, precio/unidad y modo de precio. | company_id a companies. Usada por ubicaciones y trabajos; nombre único por empresa. |
| reservations / Reservation | Reserva de estancia con entrada/salida y limpieza requerida. | location_id a locations; empresa propietaria/asignada; usuario creador/actualizador. Puede originar trabajos de checkout/siguiente entrada. |
| task_items / TaskItem | Trabajo actual: descripción, notas, evidencias JSON, precio, estado, prioridad, calendario y snapshots de facturación. | company_id a companies; location_id a locations; usuario responsable/aceptador; template_task_id a template_tasks; referencias opcionales a reservas. Padre de asignaciones, checklist, zonas, fichajes y líneas de factura. |
| task_assignments / TaskAssignment | Asignación de persona a trabajo. | task_id a task_items; user_id a users; única por trabajo/persona. |
| task_checklist_items / TaskChecklistItem | Paso estructurado de checklist. | task_id a task_items; plantilla local de espacio opcional; padre de asignaciones de checklist. |
| task_checklist_assignments / TaskChecklistAssignment | Persona/estado de un paso. | checklist_item_id a task_checklist_items; user_id a users; única por paso/persona. |
| work_sessions / WorkSession | Fichaje de usuario en ubicación/trabajo. | user_id a users; location_id a locations; task_item_id a task_items opcional con SET NULL. |
| task_reports / TaskReport | Incidencia, nota, foto o evidencia. | task_item_id a task_items; usuario/empresa reportante; empresa solicitante y checklist opcional; idempotencia por usuario/evento. |

Limitación: no hay recurrencia, orden independiente, asignación de equipo,
pausas, correcciones, aprobación de tiempo, coste laboral, material consumido,
inspección de calidad ni acciones correctivas.

### 5.6 Colaboración externa y calendario actuales

| Tabla / entidad | Responsabilidad | Relaciones de BBDD |
| --- | --- | --- |
| company_collaborations / CompanyCollaboration | Relación entre empresa iniciadora y colaboradora. | Dos FKs a companies; única por pareja. |
| company_collaboration_invitations / CompanyCollaborationInvitation | Invitación externa por email. | Empresa invitadora, usuario invitador y empresa aceptante opcional. |
| google_calendar_connections / GoogleCalendarConnection | Conexión Google Calendar con tokens cifrados. | Empresa, usuario conector y propietario. |
| platform_calendar_config / PlatformCalendarConfig | Interruptor de plataforma para calendario. | Usuario actualizador opcional. |
| company_calendar_settings / CompanyCalendarSettings | Propietario de calendario de empresa. | company_id a companies y owner_user_id a users. |
| calendar_ownership_requests / CalendarOwnershipRequest | Solicitud de cambio de propietario. | Empresa, solicitante y revisor. |
| task_calendar_events / TaskCalendarEvent | Correspondencia trabajo/evento externo. | company_id a companies, task_id a task_items y user_id a users. |
| calendar_sync_jobs / CalendarSyncJob | Cola y reintentos de sincronización. | Empresa, trabajo y usuario; payload técnico JSON. |

## 6. Modelo Enterprise objetivo

El modelo nuevo convivirá con el actual durante las migraciones. No habrá un
cambio big-bang.

### 6.1 Organización, departamentos, equipos y permisos

| Nueva entidad | Campos esenciales | Relaciones objetivo | Propósito |
| --- | --- | --- | --- |
| company_memberships / CompanyMembership | usuario, empresa, clase de plaza, estado, alta/baja, identificador empleado, admin de empresa | user_id a users; company_id a companies; padre de perfiles, departamentos, equipos, tiempo y aprobaciones | Separa identidad global de pertenencia empresarial y permite cuotas por plaza. |
| departments / Department | empresa, nombre, código, padre, estado y responsable | company_id a companies; parent_department_id a departments; responsable a membresía | Departamentos jerárquicos. |
| department_memberships | departamento, miembro, función, principal, inicio/fin | department_id a departments; membership_id a company_memberships | Pertenencia primaria/secundaria e histórico. |
| teams / Team | empresa, departamento opcional, nombre, código, estado y líder | Empresa, departamento y líder miembro | Unidad operativa real; nunca rol global. |
| team_memberships | equipo, miembro, función, inicio/fin | team_id a teams; membership_id a company_memberships | Composición y liderazgo vigente. |
| permission_profiles | empresa, nombre, descripción, estado, sistema/personalizado | company_id a companies; padre de permisos/asignaciones | Comercial, RRHH, Calidad, Finanzas u otros. |
| permission_profile_permissions | perfil, código, efecto, alcance máximo | profile_id a permission_profiles | client.read y otros permisos controlados; no strings dispersos. |
| membership_permission_profiles | miembro, perfil, inicio/fin | membership_id y profile_id | Asigna perfiles sin multiplicar roles globales. |
| scope_assignments | miembro/perfil, recurso, tipo de alcance, vigencia | Membresía/perfil y recurso concreto | Excepción justificada si el equipo no basta. |

Las clases de plaza conservan Admin, Manager, Trabajador, Accountant y
Superadmin de plataforma. Sirven para cuotas y límites no delegables. Los
perfiles de empresa determinan los permisos cotidianos.

### 6.2 Suscripción, planes y capacidades

| Nueva entidad | Campos esenciales | Relaciones objetivo |
| --- | --- | --- |
| subscription_plans | código, nombre, estado, versión y proveedor cobro | Catálogo gestionado por WorkHive. |
| plan_entitlements | plan, código de módulo/límite, tipo y valor | plan_id a subscription_plans. |
| company_subscriptions | empresa, plan, estado, inicio/fin, prueba, Stripe, versión contratada | company_id a companies y plan_id a subscription_plans; conserva historial. |
| company_entitlement_overrides | empresa, módulo/límite, valor, motivo, vigencia, configurador | Empresa y actor; solo A medida/excepción. |
| entitlement_change_audits | antes/después, actor, motivo y petición | Empresa, suscripción/override y actor. |

Códigos iniciales de módulo:

- clients, commercial_opportunities, contracts.
- locations, service_catalog, recurring_services.
- teams, time_tracking, quality_management, inventory.
- quotes, invoices, expenses, advanced_profitability.
- hr_management, integrations y exports.

Límites iniciales:

- max_active_members.
- max_admin_seats.
- max_manager_seats.
- max_worker_seats.
- max_departments, max_teams y max_locations.

La prueba usa Mega y trialing sigue siendo un estado de suscripción, no plan.

### 6.3 Clientes, Comercial, Catálogo y Contratos

| Nueva entidad | Relaciones objetivo | Propósito |
| --- | --- | --- |
| client_contacts | client_id a clients | Contactos comercial, facturación, centro, calidad y otros. |
| client_account_assignments | Cliente y company_membership | Cartera y responsable comercial. |
| commercial_opportunities | Cliente/prospecto, comercial, departamento y ubicación prevista | Solicitud comercial sin precio. |
| commercial_activities | Oportunidad y autor | Llamadas, visitas y seguimiento. |
| service_catalog_items | Empresa; padre de versiones | Catálogo único que sustituye plantillas duplicadas. |
| service_catalog_versions | Servicio, creador/aprobador | Versiones de checklist, duración, personal, requisitos y precio protegido. |
| service_agreements | Cliente, empresa, oportunidad/presupuesto opcionales | Contrato aceptado, vigencia, SLA y renovación. |
| agreement_services | Contrato y catálogo/version | Servicio contratado, frecuencia, tarifa y facturación. |
| agreement_locations | Contrato y ubicación | Centros cubiertos y vigencia. |

Clients se amplía de forma compatible; la tabla actual no se elimina en la
primera fase.

### 6.4 Ubicaciones, seguridad, equipos y material

| Nueva entidad o evolución | Relaciones / uso | Propósito |
| --- | --- | --- |
| Evolución de locations | Cliente, territorio, zona horaria, estado, código, horario y contrato. | Centro de servicio completo. |
| Evolución de location_profiles | Contacto, instrucciones, riesgos y atributos validados. | Flexibilidad sin relaciones críticas en JSON. |
| location_contacts | Ubicación y contacto/rol. | Responsable, llave, emergencia, calidad o facturación. |
| location_service_windows | Ubicación/contrato, día, hora y SLA. | Ventanas de servicio normalizadas. |
| team_location_assignments | Equipo, ubicación, alcance y vigencia. | Quién trabaja, supervisa o cubre incidencias. |
| location_documents | Ubicación, documento, clasificación y retención. | Protocolos, prevención, planos y certificados. |
| material_catalog_items | Empresa, SKU, unidad, coste estándar y categoría. | Material reutilizable. |
| warehouses y stock_locations | Empresa, sitio físico/virtual y responsable. | Stock de almacén y equipo. |
| stock_lots | Material, stock, lote, coste y caducidad. | Trazabilidad cuando aplique. |
| stock_movements | Material/lote, origen, destino, cantidad, coste, orden y autor. | Libro inmutable de movimientos. |
| team_material_assignments | Equipo, material/stock y cantidad. | Material bajo responsabilidad de equipo. |
| work_order_material_consumptions | Orden, material, cantidad y coste snapshot. | Margen real y reposición. |

Los códigos de acceso cifrados quedan aislados. Un trabajador recibe solo el
secreto o la instrucción imprescindible para una orden asignada.

### 6.5 Recurrencia, órdenes, tiempo y calidad

| Nueva entidad | Relaciones objetivo | Propósito |
| --- | --- | --- |
| recurring_service_plans | Contrato, línea de servicio, ubicación, catálogo/version y equipo. | Regla de recurrencia y generación anticipada. |
| work_orders | Empresa, cliente snapshot, contrato, ubicación, servicio/version snapshot. | Unidad individual asignable, fichable, inspeccionable y facturable. |
| work_order_assignments | Orden y miembro o equipo. | Asignación a equipo y luego personas. |
| work_order_steps | Orden, zona, checklist/version, minutos previstos y responsable. | Checklist verificable con estimación/evidencia. |
| work_order_labor_plan | Orden, función/equipo, personas y minutos previstos. | Separar previsión de fichajes reales. |
| Evolución de work_sessions | Membresía, orden, GPS inicio/fin, fuente, estado, bloqueo y aprobación. | Fichaje fiable nuevo y conservación de histórico. |
| work_session_breaks | Fichaje, inicio, fin, tipo y motivo. | Pausas auditables. |
| time_correction_requests | Fichaje, propuesta, motivo, solicitante y aprobador. | Corregir sin sobrescribir evidencia. |
| timesheet_periods y timesheet_approvals | Miembro, periodo, total y aprobador. | Cierre laboral/nómina. |
| member_cost_rates | Miembro, coste hora y vigencia. | Coste laboral confidencial. |
| quality_inspection_templates | Empresa, servicio/ubicación y versión. | Plantilla de inspección. |
| quality_inspections | Ubicación, orden, inspector, puntuación, firma y estado. | Supervisión planificada o sorpresa. |
| quality_inspection_answers | Inspección, criterio, respuesta y evidencia. | Resultado estructurado y puntuable. |
| incidents | Cliente, contrato, ubicación, orden, severidad y estado. | Incidencia o reclamación. |
| corrective_actions | Incidencia, responsable, vencimiento, verificación y cierre. | Cierre demostrable de mejora. |

Toda recurrencia genera una work order individual. Esa orden se asigna, ficha,
inspecciona, factura y analiza.

### 6.6 Finanzas Enterprise

| Nueva entidad o evolución | Propósito |
| --- | --- |
| Evolución de quotes y quote_items | Enlazar oportunidad, cliente, catálogo, centro y contrato potencial. |
| quote_revisions | Snapshot de líneas/aprobaciones. Un presupuesto aceptado se revisa, no se edita. |
| Evolución de invoices | Enlace a contrato/ubicación conservando snapshots fiscales existentes. |
| payments y payment_allocations | Cobros y reparto de pagos parciales entre facturas. |
| Evolución de expenses | Imputación a proveedor, contrato, ubicación, orden, equipo o centro de coste. |
| expense_allocations | Reparto real de gasto en múltiples destinos. |
| suppliers, purchase_orders y purchase_order_lines | Proveedor, compra y material. |
| cost_centers | Código y relación con departamento/equipo. |
| subcontractor_agreements | Tarifa y vigencia de empresa colaboradora. |

Facturas fiscales, hashes y snapshots existentes no se reescriben.

## 7. Matriz inicial de perfiles

| Área | Admin | Manager en alcance | Comercial | RRHH | Calidad | Finanzas | Trabajador |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clientes | Todo | Operativos asignados | Cartera | No | Referencia | Facturación | No |
| Oportunidades | Todo | No | Propias | No | No | Sin precio si procede | No |
| Precio/presupuesto monetario | Todo | No | No | No | No | Sí | No |
| Contratos | Todo | Operación sin precio | Estado | No | SLA | Sí | Instrucciones |
| Ubicaciones | Todo | Asignadas | Cartera sin secretos | No | Asignadas | Lectura necesaria | Orden asignada |
| Equipos/planificación | Todo | Equipo/centro asignado | No | No | Consulta | No | Propio |
| Fichajes | Todo | Equipo asignado | No | Autorizado | Consulta inspección | No salvo permiso | Propios |
| Calidad/incidencias | Todo | Centro asignado | Reclamación propia | No | Alcance completo | No | Evidencia propia |
| Personal | Todo autorizado | Equipo mínimo | No | Todo | No | Coste agregado | Perfil propio |
| Facturas/gastos/margen | Todo | No | No | No | No | Todo | No |
| Exportaciones | Configurable | Alcance | No sensible | RRHH | Calidad | Finanzas | No |

Una denegación explícita de datos financieros prevalece sobre una visibilidad
accidental de menú.

## 8. Planes y cuotas

### 8.1 Confirmado

- Básico, Mediano, Top, Mega y A medida.
- Toda persona activa cuenta como plaza.
- Prueba temporal igual a Mega.
- Básico: 1 admin, 2 managers y 5 trabajadores.
- Top: referencia de 10 admins, 20 managers y 100 trabajadores.
- Departamentos necesarios para organizaciones grandes.
- A medida configura módulos y límites para toda la empresa.

### 8.2 Pendiente de aprobación

1. Límite exacto de Mediano.
2. Límite exacto de Mega.
3. Plan mínimo para departamentos, perfiles configurables, calidad avanzada,
   inventario, RRHH e integraciones.
4. Si Básico queda en ocho plazas o sube a diez con otra distribución.
5. Política al alcanzar cupo: bloquear, invitación pendiente o exceso temporal
   auditado.
6. Si Comercial ve presupuesto sin importe o no lo ve por completo.

## 9. Orden de implementación

### Fase 0 — Contrato de dominio y preparación

- Aprobar este documento y las decisiones pendientes.
- Crear catálogo único de permisos, módulos y clases de plaza.
- Inventariar datos sin usar datos reales en pruebas.
- Preparar empresa demo Mega con departamentos ficticios.
- Definir compatibilidad API y migraciones.

Salida: decisiones aprobadas, fixtures, mapa de migración y contrato de permisos.

### Fase 1 — Fundación Enterprise

- Crear membresías, departamentos, equipos y perfiles.
- Crear planes, entitlements, overrides y cuotas transaccionales.
- Migrar roles actuales a plazas y perfiles base.
- Centralizar autorización de clientes, centros, usuarios, tiempo, trabajo y
  finanzas.
- Sustituir pantalla de roles globales por organización, perfiles y permisos de
  empresa; superadmin mantiene solo administración de plataforma.

Pruebas de salida:

- Matriz leer/escribir/exportar por perfil.
- Aislamiento por departamento/equipo/ubicación.
- Denegación directa de API.
- Límites concurrentes de plazas.
- Básico, Mega, prueba y A medida.
- Auditoría de cada cambio de permiso/entitlement.

### Fase 2 — Clientes y Comercial

- Contactos, cartera, oportunidades y actividades.
- Solicitud comercial separada de presupuesto monetario.
- Comercial sin precios.
- Migración de email/teléfono actual a contacto principal cuando proceda.

### Fase 3 — Catálogo, Presupuestos y Contratos

- Biblioteca única de servicios.
- Versiones de checklist, estimación y precio.
- Revisiones de presupuesto.
- Contratos, SLA, servicios contratados y renovación.
- Presupuesto aceptado a contrato o plan según regla aprobada.

### Fase 4 — Ubicaciones Enterprise

- Rediseño con shadcn/ui y capturas como referencia.
- Jerarquía cliente/contrato/ubicación/zona.
- Ventanas, responsables, documentos, riesgos, equipos y servicios contratados.
- Compatibilidad temporal con perfiles, acceso, zonas y plantillas actuales.

### Fase 5 — Órdenes, recurrencia y tiempo

- Recurrencia y orden individual.
- Evolución gradual de TaskItem sin destruir su tabla inicialmente.
- Equipo/persona, minutos previstos y reales.
- Pausas, GPS final, corrección, aprobación y partes.
- Coste laboral confidencial.

### Fase 6 — Calidad y supervisión

- Inspecciones, puntuación, evidencia y firma.
- Incidencias, reclamaciones, acciones correctivas y verificación.
- Métricas de calidad por centro, contrato, equipo y trabajador.

### Fase 7 — Materiales, compras y gastos

- Catálogo, stock, lotes, movimientos y material de equipo.
- Proveedores, pedidos, gastos y repartos.
- Consumo por orden, ubicación y contrato.

### Fase 8 — Cobros, margen y analítica

- Pagos parciales y conciliación.
- Rentabilidad prevista vs real.
- Coste laboral, material, gasto y subcontrata.
- Consultas analíticas de repositorio/read model, no agregados masivos del
  navegador.

### Fase 9 — Validación, PR y merge

- Migración sobre copia anonimizada o demo equivalente.
- E2E de roles y departamentos.
- Pruebas backend/frontend, typecheck, lint, build, arquitectura y React
  Doctor.
- PR y merge solo tras aprobación explícita.

## 10. Estrategia de migración

1. Añadir tablas y columnas sin eliminar las actuales.
2. Migrar datos en lotes idempotentes y registrar resultados.
3. Conciliar conteos, importes, relaciones y documentos.
4. Activar lecturas nuevas detrás de capacidad controlada.
5. Dual-write solo si es imprescindible y durante periodo acotado.
6. Mover rutas/pantallas al contrato nuevo.
7. Retirar legacy solo sin lectores, datos pendientes ni integraciones.

Reglas especiales:

- Facturas emitidas y registros fiscales nunca se reescriben.
- Si un trabajo histórico solo deduce cliente desde ubicación, se marca como
  origen derivado: no se inventa snapshot.
- Float a Numeric requiere redondeo explícito y conciliación documental.
- User a CompanyMembership conserva empresa, rol, estado y sesión; después
  obtiene perfil base.
- Toda migración se prueba sobre base vacía y fixtures históricos.

## 11. Pruebas y aceptación

Cada fase exige:

- Modelo, servicio, repositorio y ruta afectados.
- Autorización positiva, negativa y aislamiento tenant.
- Compatibilidad API cuando haya consumidores.
- Migración y reconciliación de datos.
- Dominio, permisos, navegación y formularios frontend.
- E2E con Comercial, RRHH, Operaciones, Calidad, Finanzas, Manager y
  Trabajador ficticios.
- Validación visual con shadcn/ui.
- pytest, pnpm test, typecheck, lint, build, arquitectura y React Doctor.

Escenario Enterprise mínimo:

1. Admin crea Comercial, Operaciones, Calidad y Finanzas.
2. Crea perfil Comercial sin precio.
3. Comercial crea cliente/contacto/oportunidad e intenta factura, gasto,
   rentabilidad y precio: API deniega.
4. Finanzas aprueba presupuesto y crea contrato.
5. Operaciones configura centro, zonas, equipo y recurrencia.
6. Trabajador recibe solo su orden, ficha, pausa y evidencia.
7. Calidad inspecciona y abre acción correctiva.
8. Horas/material imputan coste y margen.
9. Finanzas factura manteniendo snapshot fiscal.
10. Admin ve agregado global y manager solo equipo/centro asignado.

## 12. Riesgos y controles

| Riesgo | Control |
| --- | --- |
| Fuga de precio/dato personal | Tests API por perfil, serializadores sensibles y denegación por defecto. |
| Cambio de historial | Expandir/migrar/conciliar y snapshots. |
| Dos altas superan cuota | Validación transaccional y restricciones de datos. |
| Servicio monolítico | Extraer políticas/repositorios/servicios; no crecer módulos congelados. |
| Cálculo financiero inconsistente | Decimal, snapshots y pruebas de redondeo. |
| Dashboard lento | Paginación, índices y read models antes de agregados cliente. |
| Rol sin efecto real | Catálogo único de permisos y matriz completa de pruebas. |
| Seguridad depende de UI | Autorización siempre en backend. |
| Mezcla de trabajo local | PR por fase y preservación de cambios ajenos. |

## 13. Aprobaciones antes de Fase 1

La primera implementación necesita confirmar:

1. CompanyMembership será la fuente futura de pertenencia y cuota; User queda
   como identidad global.
2. Los roles actuales se conservan como clases de plaza y los permisos diarios
   viven en perfiles configurables por empresa.
3. Prueba igual a Mega.
4. Límites de Mediano, Mega y distribución final de Básico.
5. Desde qué plan se habilitan departamentos/perfiles personalizados.
6. Visibilidad Comercial de presupuestos.
7. Toda corrección de tiempo exige motivo, aprobación y auditoría.

Tras estas aprobaciones, la primera PR será exclusivamente la Fundación
Enterprise. No incluirá aún el rediseño de Clientes, Ubicaciones o Trabajos:
así el cambio es verificable, testeable y seguro.
