# WorkHive — plan maestro de dominio, producto y entregas

Actualizado: 3 de septiembre de 2026.

Este es el único documento de referencia para el modelo Enterprise de WorkHive,
el orden de producto y el estado comprobable de cada entrega. Sustituye los
documentos separados de blueprint, roadmap y control de entregas.

## Convención de estado

- ✅ Entregado y validado mediante pruebas y revisión de producto. Se indica si
  aún está solamente en `main` local.
- ⬜ Pendiente. No se debe asumir que existe ni usarlo como dependencia.
- Un encabezado de fase sin check significa que contiene trabajo hecho y
  trabajo pendiente; los checks son siempre de puntos concretos.

## 1. Objetivo y reglas no negociables

WorkHive será la plataforma para empresas de servicios que conecta relación
comercial, contrato, operación, personas, tiempo, coste, factura y
rentabilidad. Cleaning es el primer producto; las piezas comunes se diseñan
como WorkHive Core solo cuando el caso real las exige.

- La identidad global (`User`) y la pertenencia a una empresa
  (`CompanyMembership`) son conceptos distintos.
- Un plan habilita módulos y capacidades; un permiso determina qué puede hacer
  una persona dentro de su empresa. La interfaz nunca sustituye la autorización
  en backend.
- Un cliente, contacto externo, gestoría o partner no es un usuario interno ni
  una plaza contratada.
- Presupuesto, contrato, trabajo, factura y cobro son entidades distintas.
- El histórico fiscal y operativo no se reescribe. Las migraciones son
  aditivas, idempotentes y conciliables.
- Todo frontend usa los componentes locales basados en shadcn/ui; escritorio
  usa `Table` y móvil `Card` cuando una tabla no cabe.

## 2. Estado de publicación

- ✅ Producción: `v1.5.3` (`9c76b6d`).
- ✅ Validado en `main` local: `07e0e83` aclara Seguimiento comercial y añade
  paginación a Facturas y Presupuestos.
- ✅ Documentación unificada: este documento sustituye blueprint, roadmap y
  control de entregas duplicados; los runbooks operativos se conservan.
- ⬜ Publicar los commits locales posteriores a `v1.5.3` cuando se autorice.

## 3. Decisiones cerradas

### UI, accesibilidad y responsive

- ✅ Componentes comunes: `Dialog`, `Button`, `Input`, `Select`, `Checkbox`,
  `DatePicker`, `Table`, `Card`, `Pagination` y `PremiumTabs`.
- ✅ Diálogos con cabecera y pie translúcidos, sin blanco sólido.
- ✅ Listas de negocio: tabla shadcn en escritorio y tarjetas shadcn en móvil.
- ✅ Métricas: dos columnas en móvil; una tarjeta impar no se estira.
- ✅ Tabs: hasta cuatro opciones se muestran en fila; más de cuatro usan
  selector móvil con separación respecto del contenido.
- ⬜ Navegación unificada: sidebar shadcn responsive con rail de escritorio,
  Sheet móvil, grupos de dominio compactos, perfil en el pie y tooltips; las
  rutas, filtros de rol y entitlements existentes se conservan. Pendiente de
  validación visual final.

### Planes, límites y seguridad comercial

- ✅ Catálogo versionado Basic, Medium, Top y Enterprise; Custom es una
  excepción contractual, no una compra automática.
- ✅ `subscription_plans`, `plan_entitlements`, `plan_prices`,
  `company_subscriptions`, overrides y auditorías existen en el dominio.
- ✅ Los cambios de plan, condiciones, límites y funciones requieren una
  confirmación explícita en el panel de plataforma.
- ✅ La prueba usa las capacidades de Top; una invitación pendiente no consume
  plaza hasta convertirse en miembro activo.
- ✅ Las plazas internas y los accesos externos se cuentan por límites
  distintos. Una gestoría aceptada consume `limits.accountant_portals`, nunca
  una plaza interna; una invitación pendiente no reserva ninguno de los dos.
- ⬜ Definir la política comercial de ampliaciones y funcionalidades Custom.
- ⬜ Construir el panel comercial de superadmin: MRR, activas, impagos,
  upgrades, churn e ingresos por plan.

### Nombres de relación comercial

- ✅ La interfaz sustituye la jerga “Oportunidad” por **Seguimiento comercial**.
- ✅ La creación se llama **Nuevo seguimiento** y usa **Asunto**, **Situación**,
  **Responsable**, **Persona de contacto** y **Próximo paso**.
- ✅ Un seguimiento registra conversación, visita, propuesta y actividad; no
  mezcla presupuestos, facturas ni cobros.

### Equipo interno y accesos externos

- ✅ Administración, Operaciones, Comercial, Finanzas y Consulta son perfiles
  internos asignados a `CompanyMembership`; no representan a una gestoría ni a
  un cliente.
- ✅ **Gestoría externa** usa `ExternalAccessGrant` por empresa y el rol
  técnico `external_portal`: no recibe membresía, departamento, equipo,
  perfil interno ni plaza interna.
- ✅ El acceso de gestoría actual es revocable y de solo lectura a Finanzas
  (`finance.read`), exige la funcionalidad `features.accountant_portal` y se
  limita a la empresa que emitió el grant.
- ✅ Los antiguos usuarios con rol `accountant` se convierten de forma
  conciliable: grant activo, membresía archivada, invitaciones convertidas y
  rol retirado. El recorrido se validó en PostgreSQL sobre una base efímera.
- ⬜ Los portales de cliente y partner, el selector de varias empresas para una
  persona externa y sus políticas propias se diseñarán como entregas separadas;
  nunca heredarán perfiles internos por defecto.

### Stripe

- ✅ Hay base técnica para catálogo público, intento de compra, Checkout
  alojado, webhook firmado y activación posterior.
- ✅ Los productos de prueba se configuraron fuera del repositorio.
- ✅ Stripe permanece apagado con `BILLING_ENABLED=false`.
- ⬜ Configurar entidad legal, cuenta bancaria, descriptor, soporte y precios
  definitivos antes de activar cobros.
- ⬜ Conciliar tarifas: este plan fija Basic 29 EUR/mes o 288 EUR/año, Medium
  69/708, Top 129/1.308 y Enterprise 249/2.508, sin IVA. Los datos de prueba
  de Stripe deben coincidir exactamente antes de habilitar Checkout.
- ⬜ Probar sandbox: Checkout, webhook, provisión, cancelación, impago y
  reactivación; después repetirlo en producción.

## 4. Contrato de dominio objetivo

### Fundación Enterprise

| Dominio | Modelo objetivo |
| --- | --- |
| Organización | `CompanyMembership`, departamentos, equipos y sus pertenencias. |
| Autorización | Catálogo de permisos, perfiles, asignaciones y scopes por empresa, departamento, equipo o ubicación. |
| Acceso externo | `ExternalAccessGrant` revocable por empresa. La gestoría actual solo recibe `finance.read`; cliente y partner requieren políticas distintas. |
| Suscripción | Planes, entitlements, precios, suscripciones, overrides y auditoría. |
| Privacidad | Solicitud de supresión separada de suspender o retirar a una persona de una empresa. |

### Comercial y contratos

| Dominio | Modelo objetivo |
| --- | --- |
| Cliente | Cliente/prospecto único, contactos y responsable comercial. |
| Seguimiento | Actividades comerciales sin precio ni facturación. |
| Servicios | Catálogo, versión de servicio, checklist, duración, requisitos y precio protegido. |
| Contrato | Acuerdo, líneas de servicio, ubicaciones, SLA, vigencia y renovación. |

### Operación, calidad y finanzas

| Dominio | Modelo objetivo |
| --- | --- |
| Ubicación | Contactos, ventanas de servicio, riesgos, documentos, equipos y contrato. |
| Orden de trabajo | Recurrencia, orden individual, asignaciones, previsión laboral, pasos y material. |
| Tiempo | Sesiones, pausas, correcciones, aprobaciones y coste laboral confidencial. |
| Calidad | Plantillas, inspecciones, respuestas, incidencias y acciones correctivas. |
| Finanzas | Revisiones de presupuesto, cobros, repartos, proveedores, compras, gastos y centros de coste. |

## 5. Estado real por fase

### Fase 0 — Contrato y preparación

- ✅ Decididos componentes shadcn, responsive, aislamiento por empresa, planes
  y aplazamiento de Stripe.
- ✅ Se definió que Seguimiento comercial no es presupuesto ni factura.
- ⬜ Empresa demo Enterprise con departamentos, perfiles y datos anonimizados.
- ⬜ Inventario definitivo de compatibilidades API y de datos a migrar.
- ⬜ Catálogo único revisado de módulos, permisos y clases de plaza.
- ⬜ Endurecer el almacenamiento documental: las imágenes ya admiten objeto S3,
  pero PDF, Facturae y certificados aún usan rutas de filesystem. Migrarlos a
  claves opacas de almacenamiento de objetos cifrado, con metadatos y hashes
  en la base de datos, migración aditiva, retención y copias verificables.
  `backend/storage` actual es solo dato local ignorado por Git, no una fuente
  de verdad ni un lugar para secretos.

### Fase 1 — Fundación Enterprise

- ✅ Existen membresías empresariales, departamentos, equipos y sus relaciones.
- ✅ Existen perfiles de permisos, asignaciones a membresías y scopes de
  empresa, departamento, equipo y ubicación.
- ✅ Existen planes, entitlements, precios, overrides, suscripciones y auditoría.
- ✅ Organización, Personas, Departamentos, Equipos y Perfiles tienen UI
  responsiva, filtros y paginación.
- ✅ Invitaciones pendientes/recientes, cancelación y validación de enlaces.
- ✅ Solicitudes de privacidad y supresión existen como dominio y servicio;
  retirar a una persona de la empresa no elimina su identidad global.
- ✅ Clientes y Seguimiento comercial aplican `clients.read/manage` y
  `commercial.follow_ups.read/manage` en el backend; los perfiles base
  **Comercial** y **Consulta de clientes** son seguros, los scopes estrechos
  fallan cerrados y hay pruebas de acceso, denegación, aislamiento entre
  empresas y exclusión del panel de plataforma.
- ✅ Matriz de autorización positiva, negativa y de aislamiento para **todos**
  los dominios: clientes, ubicaciones, tiempo, trabajos y finanzas.
  - ✅ Clientes y seguimiento comercial se validan por perfil, empresa y scope;
    la denegación y el aislamiento entre empresas están cubiertos.
  - ✅ Ubicaciones, trabajos y tiempo usan `locations.*`, `work.*` y `time.*`
    en backend. Los perfiles estrechos se resuelven por ubicación y las rutas
    de lectura, escritura y tiempo quedan cubiertas con pruebas permitidas y
    denegadas.
  - ✅ Finanzas usa `finance.read/manage`: el perfil Finanzas solo consulta y
    el perfil Comercial no puede consultar ni modificar presupuestos,
    facturas, gastos o fiscalidad.
  - ✅ Una ubicación puede pertenecer opcionalmente a un departamento y a un
    equipo de ese departamento; los trabajos y el tiempo heredan ese ámbito
    desde la ubicación. Solo se resuelven ubicaciones activas y propias de la
    empresa, se bloquean relaciones cruzadas o inconsistentes y hay
    regresiones permitidas, denegadas y entre empresas.
- ✅ La decisión de cuota para invitación, activación y promoción se serializa
  con bloqueo de empresa; hay regresiones para aceptación de invitación,
  reactivación y promoción sin mutación al alcanzar el límite.
- ✅ Gestoría externa ya está separada de las plazas y perfiles internos:
  `ExternalAccessGrant`, invitación, límite propio, revocación y acceso
  financiero de solo lectura están cubiertos con regresiones permitidas,
  denegadas y de aislamiento. La migración heredada se comprobó en PostgreSQL
  aislado antes de marcar este punto.
- ⬜ Prueba de carga concurrente sobre PostgreSQL para confirmar la semántica
  de bloqueo de la base de datos de producción.
- ✅ Migración completa del rol heredado `accountant` a acceso externo; las
  plazas y perfiles base permanecen exclusivamente internos.
- ⬜ Verificación end-to-end del ciclo completo de supresión, incluida la
  revisión por empresa, escalado de plataforma y retención legal disociada.

### Fase 2 — Clientes y comercial

- ✅ Existen clientes, contactos, Seguimientos comerciales y actividades con
  historial; las rutas y servicios aíslan el cliente por empresa.
- ✅ La ficha de cliente reúne resumen, contactos, comercial, ubicaciones,
  trabajos y facturas sin duplicar información.
- ✅ Clientes, trabajos, ubicaciones, facturas y presupuestos tienen tablas
  shadcn en escritorio y tarjetas en móvil cuando corresponde.
- ✅ Facturas y Presupuestos usan paginación, encabezados azules y separadores
  de filas (`07e0e83`, validado localmente).
- ⬜ `client_account_assignments`: cartera visible y responsable comercial por
  cliente.
- ⬜ Prospecto como estado de la misma ficha y conversión a cliente sin copiar
  contactos, actividad ni ubicaciones.
- ⬜ Perfil Comercial sin acceso a precios, facturas, costes ni margen, probado
  de extremo a extremo en backend y frontend.

### Fase 3 — Catálogo, presupuestos y contratos

- ✅ Presupuestos, líneas, facturas, snapshots fiscales y rectificaciones ya
  existen y se conservan.
- ⬜ Catálogo único de servicios y versiones.
- ⬜ Revisiones y aprobaciones de presupuesto.
- ⬜ Contratos, SLA, renovaciones, servicios contratados y ubicaciones cubiertas.
- ⬜ Regla presupuesto aceptado → contrato; nunca crear un trabajo directamente.

### Fase 4 — Ubicaciones Enterprise

- ✅ Ubicaciones, perfiles operativos, zonas y acceso protegido ya existen.
- ✅ La interfaz de Ubicaciones y el acceso rápido desde Clientes existen.
- ⬜ Contactos por ubicación, ventanas/SLA, riesgos, documentos, equipos y
  servicios contratados normalizados.
- ⬜ Relación formal cliente → contrato → ubicación → zona.

### Fase 5 — Órdenes, recurrencia y tiempo

- ✅ Trabajos actuales, asignaciones, checklist, evidencias, calendario y
  sesiones de trabajo/fichaje existen.
- ✅ Los trabajos facturables pueden seleccionarse para crear facturas.
- ⬜ Modelo `work_orders` y recurrencia contractual sin destruir `TaskItem` de
  golpe.
- ⬜ Previsión de personas/minutos, pausas, GPS final, correcciones justificadas,
  aprobaciones, partes y coste laboral.

### Fase 6 — Calidad e incidencias

- ⬜ Plantillas, inspecciones, puntuaciones, fotos, firmas, incidencias,
  reclamaciones y acciones correctivas.

### Fase 7 — Material, compras y activos

- ✅ Gastos básicos existen.
- ⬜ Proveedores, catálogo de material, almacenes, stock, lotes, movimientos,
  pedidos, activos y consumo por orden.

### Fase 8 — Cobros, margen y analítica

- ✅ Facturación, registros fiscales y resúmenes financieros básicos existen.
- ⬜ Cobros, repartos de pago, conciliación, coste de personal/material/
  subcontrata y margen previsto frente a real.
- ⬜ Analítica por sociedad, delegación, cliente, contrato, ubicación, servicio,
  equipo y trabajo con permisos de lectura.

### Fase 9 — Portales e integraciones

- ✅ Colaboración externa y Google Calendar existen de forma parcial.
- ✅ Base de portal de gestoría: acceso externo por empresa, revocable y de
  solo lectura financiera, sin plaza ni membresía interna.
- ⬜ Portal de cliente y partner/inmobiliaria, y selector de varias empresas
  para gestores externos.
- ⬜ Aplicación ampliada de trabajador, API pública e integraciones auditables.
- ⬜ Automatizaciones seguras para vencimientos, avisos y aprobaciones reales.

## 6. Puerta de salida obligatoria para cada fase

La validación no es una fase funcional separada: es obligatoria antes de marcar
cualquier punto como ✅.

1. Modelo, migración, servicio, repositorio y ruta cuando cambie dominio.
2. Autorización positiva, negativa y aislamiento entre empresas.
3. Compatibilidad de API y conciliación si hay datos existentes.
4. Pruebas frontend de comportamiento, navegación, formularios y responsive.
5. `pytest`, `pnpm test`, typecheck, lint, build, guardas de arquitectura y
   React Doctor cuando correspondan.
6. Prueba real con datos demo y validación visual de producto.
7. Un commit por funcionalidad; revisión, publicación y comprobación en
   producción antes de marcarlo como publicado.

## 7. Orden de trabajo vigente

1. Cerrar los dos puntos restantes de Fase 1: prueba de carga concurrente en
   PostgreSQL y ciclo completo de supresión/retención.
2. Completar Fase 2: prospectos, cartera comercial y perfil Comercial seguro.
3. Construir Fase 3: catálogo, revisiones y contratos.
4. Completar Ubicaciones Enterprise y evolucionar trabajos a órdenes.
5. Calidad, material, cobros/margen y portales, en ese orden.
6. Retomar Stripe solo cuando los contratos, el responsable legal y los precios
   definitivos estén cerrados.

## 8. Riesgos que controlamos

| Riesgo | Control |
| --- | --- |
| Fuga de datos o precios | Autorización backend, scopes, serializadores y pruebas negativas. |
| Historial alterado | Migraciones aditivas, snapshots, conciliación y retención. |
| Cuotas superadas | Validación transaccional y pruebas concurrentes. |
| Finanzas inconsistentes | Decimal, snapshots, redondeos y conciliación documental. |
| UI divergente | Componentes shadcn locales y pruebas de arquitectura/React Doctor. |
| Stripe activado prematuramente | `BILLING_ENABLED=false`, secretos fuera del repo y sandbox previo. |
