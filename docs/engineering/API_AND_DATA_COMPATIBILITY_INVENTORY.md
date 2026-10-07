# Inventario de compatibilidad de API y datos

**Estado:** revisado el 19 de septiembre de 2026 sobre `main`.
**Objetivo:** establecer qué contratos se mantienen al cambiar WorkHive y qué
datos heredados necesitan una transición explícita. No certifica el estado de
una base de datos ni de una integración de producción: esa comprobación se
hace contra el entorno objetivo antes de retirar una compatibilidad.

## 1. Límites del contrato

- La API de producto se publica bajo `/api/v1`. El prefijo se define en
  `backend/app/core/config.py` y se registra una sola vez en
  `backend/app/main.py`.
- La aplicación web llama siempre a `/api/v1/*` mediante servicios de
  `frontend/src/services/`. La ruta Next
  `frontend/src/app/api/[...path]/route.ts` la reenvía al backend y conserva
  cookies, CSRF y las cabeceras permitidas. Una página o un componente no es
  un cliente HTTP alternativo.
- `/health` y `/health/ready` son contratos operativos, no sustitutos de la
  API de producto. Los cambios en su formato requieren avisar a los
  consumidores de despliegue.
- La visibilidad del frontend, incluido el menú, no concede permisos. Cada
  operación debe seguir resolviendo sesión, compañía, alcance y capacidad en
  el backend.
- Dentro de `v1`, un campo, semántica, autorización o código de error usado
  por la web o por una integración no se elimina ni se redefine de forma
  silenciosa. Se mantiene, se añade una alternativa compatible, se migra a
  los consumidores y se retira en una versión posterior documentada.

La definición concreta de cada operación (método, esquema, validaciones y
respuestas) es el router y los esquemas asociados; el OpenAPI generado por la
aplicación es la referencia de integración. Este documento inventaría la
superficie y sus transiciones, no duplica a mano cada payload.

## 2. Superficie API registrada

El listado siguiente contiene todos los prefijos registrados directamente por
`backend/app/api/v1/router.py`. Los módulos que comparten un prefijo componen
un único contrato de recurso; por ejemplo, `locations` agrupa espacio de
trabajo, activos, historial, accesos, zonas y plantillas de una ubicación.

| Dominio | Prefijos `/api/v1` | Cliente web principal | Regla de compatibilidad |
| --- | --- | --- | --- |
| Identidad y plataforma | `/auth`, `/users`, `/user-invitations`, `/roles`, `/companies`, `/billing`, `/trial-requests`, `/contact`, `/privacy`, `/traffic` | `auth.service.ts`, `user.service.ts`, `company.service.ts`, `company-plan-access.service.ts`, `billing.service.ts`, `privacy.service.ts` | No romper sesión, CSRF, invitaciones, plan o ciclo de cuenta sin transición y pruebas de acceso permitido/denegado. |
| Organización y ubicaciones | `/organization`, `/clients`, `/locations`, `/location-documents`, `/location-equipment`, `/reservations`, `/template-tasks`, `/work-sessions`, `/work-session-corrections`, `/labor-costs`, `/calendar` | `organization.service.ts`, `client.service.ts`, `location-*.service.ts`, `reservation.service.ts`, `template.service.ts`, `work-session.service.ts`, `calendar.service.ts` | El `company_id` y el alcance de ubicación siguen siendo obligatorios en servicios del backend; una URL conocida nunca evita esa comprobación. |
| Operación y calidad | `/task-items`, `/task-reports`, `/notifications`, `/quality-templates`, `/quality-inspections`, `/quality-corrective-actions`, `/quality-evidence`, `/work-orders` | `task.service.ts`, `quality.service.ts`, `work-order.service.ts`, `notification.service.ts` | Conservar las instantáneas históricas de tarea, inspección y orden; los cambios nuevos no reinterpretan evidencia ya registrada. |
| Actualización en tiempo real | `/realtime` | `useRealtimeEvents.ts` | El stream SSE exige una sesión autorizada y sólo entrega señales de invalidación permitidas, sin datos de empresa. Cada lectura posterior conserva su autorización habitual. |
| Comercial | `/quotes`, `/service-contracts`, `/client-opportunities`, `/client-account-assignments` | `quote.service.ts`, `service-contract.service.ts`, `client.service.ts`, `client-account-assignment.service.ts` | Las revisiones y condiciones aceptadas son inmutables; añadir campos no altera una revisión o contrato ya emitido. |
| Finanzas | `/invoices`, `/customer-payments`, `/bank-reconciliation`, `/sales-ledger`, `/fiscal-summary`, `/client-profitability`, `/margin-forecasts`, `/accounting-exports`, `/invoice-email-contacts`, `/fiscal-settings` | `invoice.service.ts`, `customer-payment.service.ts`, `bank-reconciliation.service.ts`, `fiscal-summary.service.ts`, `accounting-export.service.ts` | Importes, cobros, conciliación y documentos fiscales son trazables. Las correcciones se modelan como operaciones, no sobrescriben un historial cerrado. |
| Compras y existencias | `/expenses`, `/inventory`, `/inventory/purchases`, `/uploads` | `expense.service.ts`, `inventory.service.ts`, `inventory-purchase.service.ts`, `upload.service.ts` | Una compra enlaza gasto y entradas de stock sin duplicar su efecto: finanzas suma gasto e inventario suma movimientos. Los ajustes revierten o compensan movimientos. |
| Colaboración y portales | `/collaborations`, `/partner-portal`, `/client-portal`, `/audit-logs` | `collaboration.service.ts`, `partner-portal.service.ts`, `client-portal.service.ts`, `audit-log.service.ts` | Los portales son concesiones externas separadas de plazas internas y sólo devuelven los recursos autorizados para su compañía y alcance. |
| Gestión de integraciones | `/api-access-keys`, `/public` | `api-access-key.service.ts` | Las claves son revocables, auditadas y ligadas a una compañía y a scopes explícitos. |

Los tres prefijos de calidad se registran por
`backend/app/api/v1/quality.py`; los de oportunidad y asignación de cuenta se
anidan bajo `/clients` por sus routers. Este inventario conserva los prefijos
de entrada para evitar presentar esas rutas anidadas como APIs paralelas.

### 2.1 API pública con clave

La superficie pública deliberadamente pequeña es `/api/v1/public` y no usa la
sesión de navegador:

| Operación | Scope requerido | Garantía actual |
| --- | --- | --- |
| `GET /public/work-orders` y `GET /public/work-orders/{work_order_id}` | `work_orders:read` | Sólo órdenes de la compañía de la clave; paginación entre 1 y 100. |
| `PUT /public/reservations/{source}/{external_reference}` | `reservations:write` | Alta/actualización idempotente por compañía, fuente y referencia externa. |

Estas rutas requieren `X-WorkHive-API-Key`, aplican limitación de tasa,
registran uso/auditoría y rechazan una clave revocada, ajena o sin scope.
Antes de ampliar esta API se añade un schema y una prueba de aislamiento por
compañía, además de una prueba de scope denegado. No se expone un router de
administración de empresa a través de `/public`.

## 3. Datos y compatibilidades que siguen existiendo

| Área heredada | Estado actual | Fuente de verdad | Condición antes de retirarla |
| --- | --- | --- | --- |
| Códigos históricos de plan | `free → basic`; `trial`, `pro` y `lifetime → top`; `business → medium`; cualquier valor desconocido → `basic`. | `legacy_plan_code` en `backend/app/services/entitlement_catalog.py`; suscripciones y catálogo versionado. | Contar los valores heredados, migrar cada compañía a una suscripción canónica y verificar sus entitlements antes de eliminar el normalizador. Nunca se cambian códigos en caliente sólo desde el frontend. |
| Rol interno a membresía y perfiles | La migración crea `company_memberships` desde roles: `admin → admin`, `manager/accountant → responsible`, resto → `worker`. Los administradores reciben el perfil de empresa y scope de compañía. | `j9k0l1m2n3o4_add_enterprise_access_foundation.py`; autorización de organización. | Confirmar que todo miembro activo tiene perfiles/scopes explícitos y que `permissions_configured` refleja la decisión antes de retirar el fallback de rol heredado. |
| Gestor externo | Los antiguos `accountant` se convierten en usuarios `external_portal` con un `ExternalAccessGrant`; las membresías internas y asignaciones activas se archivan. | `f9a0b1c2d3e4_add_external_access_grants.py`; `external_access_policy.py`. | Auditar concesiones activas, caducadas y revocadas. No volver a representar un gestor externo como plaza interna ni recrear membresías para compatibilidad. |
| Contactos operativos de ubicación | Se copian contactos no vacíos de `location_profiles` a `location_contacts`, como contacto general primario. | `n7o8p9q0r1s_add_location_operational_contacts.py`. | Comparar recuentos y datos de contacto antes de retirar cualquier lector heredado; no inferir o inventar personas de contacto. |
| Cadena reserva–tarea | Para tareas no facturadas se rellena la siguiente reserva y las fechas operativas a partir de la estancia actual. No hay downgrade exacto. | `f4c5d6e7f8a9_backfill_reservation_task_chain.py`. | Revisar excepciones y tareas facturadas; una corrección posterior debe ser explícita, no volver a ejecutar ciegamente el backfill. |
| Invitaciones de reincorporación | `rejoin_user_id` es nullable y apunta a `users`; no requiere backfill. | `q6r7s8t9u0v1_add_invitation_rejoin_identity.py`. | Mantener nullable hasta que todas las invitaciones antiguas hayan expirado o se hayan resuelto de forma auditada. |
| Acceso redundante de compañía a su propia ubicación | La migración elimina sólo filas redundantes de `location_company_access`; no es reversible con fidelidad. | `f3b4c5d6e7f8_cleanup_self_location_access.py`. | No se vuelve a ejecutar como script manual. Cualquier incidencia se corrige como nuevo acceso explícito y auditado. |
| PDFs, Facturae y certificados fiscales en filesystem | Las nuevas referencias usan objeto opaco, tipo, tamaño y hash. Las rutas de fichero antiguas siguen siendo legibles hasta la migración por compañía. | `legacy_document_storage_migration_service.py` y `backend/scripts/migrate_legacy_documents.py`. | Ejecutar primero dry-run y después `--apply --company-id …` o `--all` autorizado. La copia se verifica por contenido/hash y relectura antes de limpiar sólo la ruta de base de datos; el origen no se borra. |
| Certificado global de firma Facturae | Admite referencia a AWS Secrets Manager; el archivo continúa como alternativa local compatible. La configuración rechaza secreto y archivo simultáneos. | `facturae_signing_credentials_service.py` y configuración. | Crear el secreto real y un permiso mínimo de producción, probar una firma real y retirar el archivo sólo cuando exista evidencia de recuperación y firma correctas. |

## 4. Puerta de salida para cambios de datos

Antes de eliminar una compatibilidad o hacer una migración que cambie datos
existentes se debe completar, en este orden:

1. Identificar compañía, tablas, valores y consumidores que quedarán
   afectados; preparar una copia recuperable y verificar su restauración.
2. Añadir el esquema o campo de destino de forma aditiva y desplegar un lector
   compatible que entienda ambos estados.
3. Ejecutar el backfill idempotente y con alcance acotado; para documentos se
   usa el script de migración y nunca un borrado masivo de origen.
4. Medir las filas pendientes y las discrepancias. Los datos con fallo pasan a
   revisión, no se silencian ni se fuerzan a un valor por defecto.
5. Cambiar todos los escritores al formato nuevo, mantener lectura
   compatible durante el periodo acordado y probar tanto datos antiguos como
   nuevos.
6. Sólo con cero pendientes verificados, retirar el lector heredado en otra
   entrega, incluyendo una prueba de regresión y notas de despliegue.

Las revisiones Alembic se aplican por la cadena normal de migraciones, no con
`Base.metadata.create_all`. Los tests de migración de PostgreSQL verifican que
la base llegue al único `head` y que el esquema publicado siga concordando con
los contratos de modelos y rutas.

## 5. Regla para los próximos cambios

Un cambio que afecte a un recurso de esta lista debe actualizar en la misma
entrega:

- router y schema del backend, servicio de frontend y pruebas focalizadas;
- reglas de permiso, compañía y alcance para los caminos permitidos y
  denegados;
- migración/backfill y estrategia de rollback cuando toca datos existentes;
- este inventario si se añade, renombra o retira un prefijo o una transición
  de datos.

`backend/tests/test_api_data_compatibility_inventory.py` impide que un prefijo
registrado directamente en el router quede fuera de este documento. Es una
alarma de mantenimiento: no sustituye la revisión de esquemas ni permite
ocultar un cambio rompiendo el test.

## 6. Fuentes revisadas

- `backend/app/api/v1/router.py` y `backend/app/api/v1/api_access.py`.
- `backend/app/api/v1/public_api.py` y
  `backend/app/services/api_access_key_service.py`.
- `frontend/src/lib/api.ts`, `frontend/src/lib/api-proxy.ts` y
  `frontend/src/app/api/[...path]/route.ts`.
- `backend/app/services/entitlement_catalog.py`,
  `backend/app/services/organization_authorization_service.py` y
  `backend/app/services/external_access_policy.py`.
- Las revisiones Alembic y el script de documentos nombrados en la tabla de
  compatibilidades.
