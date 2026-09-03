# Guardas de arquitectura

Este documento convierte una parte verificable de KISS, DRY, SOLID y la
separación de responsabilidades en un control de CI. No pretende que un
contador de líneas pueda decidir si un diseño es bueno: las decisiones de
dominio siguen requiriendo revisión humana.

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
- Cliente y partner deben llegar con su propio tipo de grant, política,
  serializador y pruebas de aislamiento. No se reutilizan perfiles internos ni
  se amplía la política de gestoría por similitud.

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
