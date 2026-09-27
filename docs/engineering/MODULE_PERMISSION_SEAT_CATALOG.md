# Catálogo de módulos, permisos y clases de plaza

**Estado:** revisado el 19 de septiembre de 2026 sobre `main`.

Este es el mapa de producto y autorización de WorkHive. No sustituye las
comprobaciones del backend ni promete que una capacidad esté comercialmente
disponible sólo porque figure en el modelo de datos.

## 1. Cuatro conceptos que no se mezclan

| Concepto | Pregunta que responde | Fuente de verdad |
| --- | --- | --- |
| Módulo | «¿La empresa tiene contratada y habilitada esta parte del producto?» | Entitlements `features.*` de su suscripción y sus overrides. |
| Permiso | «¿Puede esta persona realizar esta acción?» | Definición, perfil asignado y `require_capability` en el servicio backend. |
| Scope | «¿Sobre qué empresa, departamento, equipo o ubicación puede hacerlo?» | Scope de la asignación de perfil y resolución de ubicaciones. |
| Plaza o acceso externo | «¿Qué capacidad comercial consume esta identidad?» | `CompanyMembership` activa o el grant externo correspondiente. |

Una operación permitida debe superar las cuatro capas aplicables: módulo,
identidad activa, permiso/scope y propiedad del recurso. El menú sólo sirve de
orientación; ocultar una entrada no concede ni revoca acceso. Un `403` del
backend es el resultado correcto si falta cualquiera de esas capas.

## 2. Módulos de producto

El estado comercial procede de
`backend/app/services/entitlement_catalog.py`. `available` significa que se
puede presentar como capacidad entregada cuando el plan efectivo la habilita;
`coming_soon` permanece fuera de la oferta aunque un plan técnico tenga su
valor activado; `platform_internal` nunca se vende a una empresa cliente.

| Estado | Entitlements y módulo |
| --- | --- |
| Disponible | `features.organization` — Organización; `features.teams` — Equipos; `features.clients` — Clientes y seguimiento comercial; `features.locations` — Ubicaciones; `features.work_orders` — Órdenes de trabajo; `features.time_tracking` — Control horario; `features.quotes` — Presupuestos; `features.invoices` — Facturas; `features.planning` — planificación avanzada de reservas y calendario de empresa; `features.profitability` — Rentabilidad; `features.accountant_portal` — Portal de gestoría; `features.partner_portal` — Portal de colaboradores; `features.api` — Acceso API. |
| Próximamente | `features.service_catalog` — Catálogo de servicios; `features.recurrence` — Trabajo recurrente; `features.basic_exports` — Exportaciones básicas; `features.client_portal` — Portal de cliente; `features.quality` — Control de calidad; `features.inventory` — Inventario; `features.hr` — Recursos humanos; `features.approvals` — Aprobaciones; `features.branches` — Delegaciones; `features.corporate_structure` — Estructura corporativa. |
| Interno de plataforma | `features.integrations` — Integraciones; `features.advanced_integrations` — Integraciones avanzadas. |

Que una pantalla o un endpoint existan durante desarrollo no cambia ese
estado. Por ejemplo, calidad e inventario tienen flujos implementados, pero
siguen clasificados `coming_soon` para no venderlos ni anunciarlos como
entrega comercial hasta completar su activación y revisión.

### 2.1 Planes y módulos

Los planes fijan valores técnicos de entitlement. El catálogo comercial vuelve
a filtrarlos por el estado anterior:

| Plan | Base técnica |
| --- | --- |
| Basic | Organización, equipos, clientes, ubicaciones, órdenes, tiempo, presupuestos y facturas. |
| Medium | Basic más los códigos de catálogo de servicios, recurrencia, planificación, exportaciones básicas y portal de cliente. |
| Top | Medium más calidad, rentabilidad, inventario, RR. HH., portal de colaboradores, gestoría, integraciones y aprobaciones. |
| Enterprise (`mega`) | Todos los `features.*`. |
| Personalizado (`custom`) | Parte de un plan activo y se ajusta mediante condiciones y overrides auditados; no es una compra automática. |

Por tanto, `features.quality=true` en una suscripción no autoriza a ofrecer
Calidad como producto hasta que el catálogo cambie su estado a `available`.
Tampoco una excepción de plan sustituye el permiso de una persona.

## 3. Catálogo de permisos de compañía

Los permisos siguientes son las definiciones base que se crean por empresa.
Se asignan mediante perfiles y scopes; no se asignan por una página concreta
ni directamente por un elemento del sidebar.

| Área | Permisos | Uso |
| --- | --- | --- |
| Acceso | `access.members.read`, `access.members.manage`, `access.profiles.read`, `access.profiles.manage`, `access.scopes.manage` | Consultar y administrar miembros, perfiles y alcances. |
| Empresa | `company.settings.manage` | Cambios de configuración de compañía. |
| Organización | `organization.departments.read`, `organization.departments.manage`, `organization.teams.read`, `organization.teams.manage` | Consultar y gestionar departamentos y equipos. |
| Clientes y comercial | `clients.read`, `clients.manage`, `commercial.follow_ups.read`, `commercial.follow_ups.manage` | Clientes, contactos y seguimientos comerciales. |
| Ubicaciones | `locations.read`, `locations.manage` | Consultar y gestionar ubicaciones. |
| Operación | `work.read`, `work.manage` | Consultar y gestionar órdenes y tareas. |
| Tiempo | `time.read`, `time.manage`, `time.approve` | Consultar, registrar y aprobar correcciones de tiempo. |
| Inventario | `inventory.read`, `inventory.manage` | Proveedores, catálogo material, almacenes y movimientos. |
| Finanzas | `finance.read`, `finance.manage`, `labor_costs.read`, `labor_costs.manage` | Datos financieros y, por separado, costes laborales confidenciales. |
| Calidad | `quality.templates.read`, `quality.templates.manage`, `quality.inspections.read`, `quality.inspections.manage`, `quality.incidents.read`, `quality.incidents.manage`, `quality.complaints.read`, `quality.complaints.manage` | Plantillas, inspecciones, incidencias, acciones correctivas y reclamaciones. |

Los siguientes permisos son exclusivos de un perfil de sistema de
administración y no se pueden introducir en un perfil personalizado:

- `access.members.manage`
- `access.profiles.manage`
- `company.settings.manage`
- `finance.manage`
- `labor_costs.read`
- `labor_costs.manage`

Esta reserva evita que un perfil custom convierta a una persona en
administrador de facto. También se aplica a una asignación histórica: que el
código exista en una tabla antigua no basta para obtener el permiso.

### 3.1 Perfiles base

Los perfiles son puntos de partida por empresa, no clases de plaza. Los cuatro
no administrativos no se sobrescriben de forma silenciosa después de que una
empresa los haya adaptado.

| Perfil | Permisos incluidos por defecto | Finalidad |
| --- | --- | --- |
| Administrador de empresa | Todas las definiciones activas de la tabla anterior, con scope de compañía. | Configuración completa de la empresa. Sólo una membresía de clase `admin` lo recibe automáticamente. |
| Comercial | `clients.read`, `clients.manage`, `commercial.follow_ups.read`, `commercial.follow_ups.manage` | Clientes y seguimiento, sin acceso financiero. |
| Consulta | `locations.read`, `work.read`, `time.manage` | Consulta operativa y registro de su propio tiempo, sin comercial ni finanzas. |
| Operaciones | Organización de lectura; ubicaciones, órdenes, tiempo, inventario y calidad de lectura/gestión. | Ejecutar y coordinar operación sin comercial ni finanzas. |
| Finanzas | `finance.read` | Consulta de presupuestos, facturas, gastos y fiscalidad, sin edición. |

Una asignación puede tener scope de `company`, `department`, `team` o
`location`. La comprobación de ubicación resuelve estos scopes a ubicaciones
permitidas antes de leer o modificar recursos. Los permisos reservados exigen
además un perfil de sistema; por eso no basta con copiar su código a otro
perfil.

## 4. Plazas internas

Una plaza es una `CompanyMembership` activa y su `access_class` es sólo su
clase comercial/organizativa. No es un paquete implícito de permisos.

| Clase | Límite de plan | Regla de acceso |
| --- | --- | --- |
| `admin` | `limits.internal_admins` | Puede recibir automáticamente Administrador de empresa con scope de compañía. La empresa debe conservar al menos un administrador activo. |
| `responsible` | `limits.internal_responsibles` | Responsable interno; sus acciones dependen de perfiles y scopes asignados. |
| `worker` | `limits.internal_workers` | Trabajador interno; sus acciones dependen de perfiles y scopes asignados. |

Cambiar de clase, suspender o retirar una membresía invalida las sesiones
afectadas y comprueba el límite de destino. La compatibilidad temporal de los
roles técnicos `admin`, `manager` y `viewer` sólo cubre miembros sin perfiles
explícitos. En cuanto se guarda una selección —incluso vacía—
`permissions_configured` evita que un rol heredado restaure privilegios.

Las estructuras también tienen límites independientes: cada departamento
activo consume `limits.departments` y cada equipo activo consume
`limits.teams`. No consumen plazas internas ni sustituyen un scope de perfil.

**Regla de administración:** un administrador de empresa ve y gestiona todas
las funcionalidades de su compañía que estén efectivamente habilitadas por su
plan, su perfil de sistema y su scope de compañía. No salta un entitlement:
si el plan no incluye Acceso API, Calidad o cualquier otro módulo, el backend
lo seguirá bloqueando aunque la persona sea administradora. El `superadmin`
de plataforma es una identidad aparte, sin contexto de compañía, y no consume
una plaza de cliente.

## 5. Accesos externos: nunca plazas internas

| Acceso | Modelo y consumo | Alcance actual |
| --- | --- | --- |
| Gestoría externa | `ExternalAccessGrant` de tipo `accountant`; consume `limits.accountant_portals`, no una plaza interna. Exige `features.accountant_portal`. | Sólo `finance.read` de la empresa que concedió el grant; revocable y con caducidad opcional. |
| Colaborador patrocinado | `PartnerPortalGrant`; consume `limits.partner_portals`, no una plaza interna. Exige `features.partner_portal`. | Operación patrocinada entre empresa anfitriona y colaboradora; no hereda perfiles internos. |
| Cliente | `ClientPortalGrant`; no es un `ExternalAccessGrant` ni una membresía. | Queda ligado a un cliente concreto y a su workspace; `features.client_portal` continúa `coming_soon`. |

`limits.external_portals` sigue siendo una capacidad genérica de catálogo,
pero no hay un contador/flujo de alta independiente que la aplique todavía.
No se debe usar para vender o implementar un nuevo portal: primero se crea su
modelo, concesión revocable, contador y prueba de aislamiento. En cambio,
gestoría, colaboradores y almacenamiento documental sí tienen comprobaciones
de cuota específicas. El almacenamiento de documentos de ubicación consume
`limits.location_document_storage_bytes` con una reserva previa a la subida.

## 6. Mantenimiento obligatorio

Al crear o modificar un módulo, permiso o plaza en una entrega se actualizan
en conjunto:

1. el catálogo de entitlements o de definiciones de permiso;
2. el servicio que aplica módulo, permiso, scope y aislamiento;
3. perfiles base, límites y grant externo si procede;
4. pruebas de acceso permitido, denegado y aislamiento; y
5. este catálogo y el inventario de compatibilidades API/datos.

El test `backend/tests/test_module_permission_seat_catalog.py` evita que un
entitlement, cuota, permiso base o permiso reservado nuevo se quede sin
catalogar. Es una alerta de mantenimiento, no sustituye la autorización en
runtime.

## 7. Fuentes revisadas

- `backend/app/services/entitlement_catalog.py` y
  `backend/app/services/entitlement_service.py`.
- `backend/app/services/organization_base_profile_service.py`,
  `backend/app/services/organization_permission_policy.py` y
  `backend/app/services/organization_authorization_service.py`.
- `backend/app/models/company_membership.py`,
  `backend/app/models/external_access_grant.py`,
  `backend/app/models/partner_portal_grant.py` y
  `backend/app/models/client_portal_grant.py`.
- `backend/app/services/external_access_policy.py` y
  `backend/app/services/company_entitlement_safety_service.py`.
