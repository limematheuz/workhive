# Guardas de arquitectura

Este documento convierte una parte verificable de KISS, DRY, SOLID y la
separación de responsabilidades en un control de CI. No pretende que un
contador de líneas pueda decidir si un diseño es bueno: las decisiones de
dominio siguen requiriendo revisión humana.

Para páginas, componentes y hooks de frontend, el tamaño no es un límite de
diseño universal. Antes de implementar se debe identificar la responsabilidad,
el estado que posee, su frontera de datos y las secciones de interfaz; cada una
se extrae cuando pueda evolucionar o probarse de forma independiente. React
Doctor bloquea regresiones nuevas de seguridad, accesibilidad, rendimiento y
corrección. Sus avisos de tamaño de componente y de preferencia por reducer se
mantienen como diagnóstico, no como sustituto de ese diseño previo.

## Límites que CI aplica

- Un servicio nuevo de backend no puede superar 350 líneas.
- Una ruta nueva de API no puede superar 250 líneas.
- Un servicio nuevo de frontend no puede superar 250 líneas.
- Los módulos históricos que ya eran mayores tienen un límite congelado: no
  pueden crecer. Para añadir comportamiento hay que extraer una pieza enfocada
  antes —por ejemplo, una política, un repositorio, un serializador o un
  servicio de dominio—.
- Una ruta no puede añadir acceso directo a SQLAlchemy. Las cuatro excepciones
  existentes están registradas explícitamente como deuda técnica; una nueva
  llamada, o una modificación que aumente esa deuda, rompe CI.
- Un componente, hook o página de frontend no puede hacer `fetch` ni `apiFetch`
  directamente. Debe usar `frontend/src/services`.

La prueba se ejecuta con:

```bash
pnpm test:architecture
```

También forma parte obligatoria de CI en cada PR.

## Audiencias internas y accesos externos

- `CompanyMembership` representa exclusivamente a una persona del equipo
  interno. Sus perfiles, departamentos, equipos y scopes no se pueden asignar
  a una gestoría, cliente o partner.
- Un acceso externo se expresa con `ExternalAccessGrant`, siempre ligado a una
  empresa, revocable y verificado en el servicio de autorización. El rol
  técnico `external_portal` por sí solo no concede ninguna capacidad.
- La política actual de gestoría permite únicamente `finance.read`, exige
  `features.accountant_portal` y usa `limits.accountant_portals`; nunca
  consume una cuota `limits.internal_*`.
- Un partner inmobiliario patrocinado usa `PartnerPortalGrant`, ligado a una
  colaboración B2B concreta, a la empresa anfitriona que paga el acceso y a
  una persona. El rol técnico `partner_portal` no recibe membresía, perfil,
  departamento, equipo ni plaza interna.
- El alta de una inmobiliaria nueva usa `SponsoredPartnerInvitation`, no la
  invitación B2B de empresas ya activas. Al aceptar el token y código de un
  solo uso, una transacción crea la empresa `property_manager` sin plan, su
  usuario `partner_portal`, colaboración aceptada y grant inicial. La cuota
  `limits.partner_portals` se comprueba bajo el bloqueo de la empresa
  anfitriona; una invitación pendiente nunca reserva una plaza.
- La política de partner valida grant activo, colaboración aceptada, empresa
  anfitriona activa y `features.partner_portal`; solo expone propiedades de la
  inmobiliaria y reservas asignadas a esa anfitriona. La inmobiliaria no elige
  otro proveedor ni accede a trabajadores, costes, facturas o dashboard del
  anfitrión.
- La creación de una propiedad desde el portal conserva como propietario y
  gestor a la inmobiliaria. La anfitriona se añade automáticamente como
  `default_service_provider`, con tareas permitidas y reservas/datos sensibles
  denegados; esa ruta no reutiliza la API interna de ubicaciones.
- Cliente y cualquier futuro portal externo deben llegar con su propio grant,
  política, serializador y pruebas de aislamiento. No se reutilizan perfiles
  internos ni se amplía la política de gestoría por similitud.
- La interfaz puede agrupar estos recorridos bajo **Red externa**, pero esa
  navegación no fusiona `CompanyCollaboration`, `PartnerPortalGrant` y
  `ExternalAccessGrant`, ni permite que una tab amplíe los permisos de otra.

## Cómo trabajar cuando una pieza empieza a crecer

1. Mantén la ruta como transporte: validación HTTP, dependencia de usuario y
   respuesta. No añadas reglas de negocio ni consultas nuevas.
2. Coloca autorización, reglas y transacciones en un servicio de dominio.
3. Extrae consultas a un repositorio cuando se reutilicen o expresen una
   intención de lectura/escritura concreta.
4. Extrae una responsabilidad autónoma antes de aumentar el presupuesto de un
   archivo: facturación, calendario, serialización, política de estados, etc.
5. Añade pruebas de regresión de la regla extraída y conserva los contratos API.

No se aumenta un límite para desbloquear una entrega. Si una excepción fuese
inevitable, debe ir acompañada de una reducción o separación concreta en la
misma PR y de una justificación revisable.
