# WorkHive — plan maestro de dominio, producto y entregas

Actualizado: 6 de septiembre de 2026.

Este es el único documento de referencia para el modelo Enterprise de WorkHive,
el orden de producto y el estado comprobable de cada entrega. Sustituye los
documentos separados de blueprint, roadmap y control de entregas.

## Convención de estado

- ✅ Entregado y validado mediante pruebas y revisión de producto. Se indica si
  aún está solamente en `main` local.
- 🟡 Implementado y cubierto por pruebas, pendiente de revisión visual o de
  producción; no se considera publicado.
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

- ✅ Producción: `v1.6.1` (`c3da6be`), publicada desde `main` con imágenes
  inmutables en ECR y despliegue SSM verificado. Backend, frontend, React
  Doctor, SAST, secretos y GitGuardian terminaron correctamente.
- ✅ `main` local y `origin/main` están alineadas en `3a0c034`; incluye la
  preparación versionada de mantenimiento seguro del host, observabilidad y
  migración de cuenta AWS. La asociación semanal, agente CloudWatch y alarma
  se aplican en AWS como paso operativo separado.
- ✅ Seguimiento comercial y la paginación de Facturas y Presupuestos están
  publicados; el cambio inicial fue `07e0e83`.
- ✅ Documentación unificada: este documento sustituye blueprint, roadmap y
  control de entregas duplicados; los runbooks operativos se conservan.

## 3. Decisiones cerradas

### UI, accesibilidad y responsive

- ✅ Componentes comunes: `Dialog`, `Button`, `Input`, `Select`, `Checkbox`,
  `DatePicker`, `Table`, `Card`, `Pagination` y `PremiumTabs`.
- ✅ Diálogos con cabecera y pie translúcidos, sin blanco sólido.
- ✅ Listas de negocio: tabla shadcn en escritorio y tarjetas shadcn en móvil.
- ✅ Métricas: dos columnas en móvil; una tarjeta impar no se estira.
- ✅ Tabs: escritorio puede mostrarlas en fila; tablet y móvil siempre las
  compactan en el mismo selector desplegable, con la misma cantidad, orden y
  reglas de visibilidad de opciones que el escritorio.
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
- ✅ **Red externa** unifica la navegación de empresas colaboradoras y accesos
  profesionales en dos tabs, sin fusionar sus modelos ni permisos: la
  colaboración B2B y el portal inmobiliario siguen en Operación; la gestoría
  financiera sigue siendo un `ExternalAccessGrant` de solo lectura. Las rutas
  históricas redirigen de forma compatible. Validada con navegación E2E
  autenticada local en `v1.6.1`.
- ✅ Los antiguos usuarios con rol `accountant` se convierten de forma
  conciliable: grant activo, membresía archivada, invitaciones convertidas y
  rol retirado. El recorrido se validó en PostgreSQL sobre una base efímera.
- ✅ El portal patrocinado de una **inmobiliaria ya colaboradora** usa
  `PartnerPortalGrant`, el rol técnico `partner_portal`, cuota
  `limits.partner_portals` de la empresa anfitriona y rutas propias. Solo
  muestra propiedades propias y solicitudes de limpieza hacia la anfitriona;
  no recibe dashboard, plazas ni perfiles internos. Validado con E2E
  autenticada local en `v1.6.1`.
- ✅ La inmobiliaria crea sus propias propiedades desde su portal. La propiedad
  queda bajo su propiedad y gestión; se comparte automáticamente y solo con la
  empresa anfitriona como proveedor predeterminado, que puede gestionar tareas
  pero no reservas ni datos sensibles.
- ✅ El portal usa el formulario canónico completo de ubicaciones también al
  crear la primera propiedad. La inmobiliaria puede editar o archivar solo sus
  propiedades y editar o cancelar una solicitud solo antes de que exista
  trabajo iniciado, sesiones o factura; el backend conserva el aislamiento y
  rechaza cambios de proveedor, colaboración o empresa anfitriona.
- ✅ Los formularios modales compartidos avisan antes de descartar cambios por
  cierre, fondo o Escape. Los flujos encadenados de la Red externa permiten
  volver al paso anterior sin perder el borrador.
- ✅ El alta de una **inmobiliaria patrocinada nueva** tiene una invitación
  propia, distinta de la B2B histórica: email y código de un solo uso, datos
  legales y contraseña en el enlace seguro, alta atómica de empresa sin plan,
  colaboración aceptada y `PartnerPortalGrant` inicial. No crea membresía,
  perfil, departamento, equipo ni plaza interna; la cuota se bloquea en la
  empresa anfitriona al aceptar. Está cubierta por pruebas de aceptación,
  denegación de dashboard genérico, revocación y no sobrescritura de cuentas,
  además de validar la migración desde su revisión anterior.
- ✅ La interfaz de la alta patrocinada nueva conserva el borrador al volver
  entre pasos y completa la aceptación segura con datos legales, credenciales
  e inicio de sesión restringido al portal. Validada con E2E autenticada local
  en `v1.6.1`; no se ha convertido ningún dato existente de forma automática.
- ⬜ Diseñar el portal de cliente y el selector de varias empresas para una
  persona externa; cada uno con política propia y sin heredar perfiles internos.

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
| Acceso externo | `ExternalAccessGrant` para gestoría financiera; `PartnerPortalGrant` para inmobiliaria patrocinada ligada a una colaboración. El alta patrocinada se inicia con `SponsoredPartnerInvitation`, no con una invitación B2B de pago. Cliente requiere política propia. |
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
- ✅ Prueba de carga concurrente sobre PostgreSQL confirma el bloqueo de la
  base de datos de producción: cinco transacciones simultáneas para alta de
  plaza, promoción y portal de gestoría dejan exactamente una concesión válida.
- ✅ Migración completa del rol heredado `accountant` a acceso externo; las
  plazas y perfiles base permanecen exclusivamente internos.
- ✅ Verificación end-to-end del ciclo completo de supresión: solicitud,
  revisión por empresa, resolución por plataforma, anonimización y revocación
  de sesión; el expediente se conserva hasta su plazo legal mientras que las
  IP de auditoría se anonimizan de forma independiente.

### Fase 2 — Clientes y comercial

- ✅ Existen clientes, contactos, Seguimientos comerciales y actividades con
  historial; las rutas y servicios aíslan el cliente por empresa.
- ✅ La ficha de cliente reúne resumen, contactos, comercial, ubicaciones,
  trabajos y facturas sin duplicar información.
- ✅ Clientes, trabajos, ubicaciones, facturas y presupuestos tienen tablas
  shadcn en escritorio y tarjetas en móvil cuando corresponde.
- ✅ Facturas y Presupuestos usan paginación, encabezados azules y separadores
  de filas (`07e0e83`, validado localmente).
- ✅ `client_account_assignments`: cartera visible y responsable comercial por
  cliente, con selección de responsables elegibles, filtros y regresiones de
  aislamiento (`1c0c64f`, `fda26b0`, `f756555`).
- ✅ Prospecto como estado de la misma ficha y conversión a cliente sin copiar
  contactos, actividad ni ubicaciones. La regresión cubre la conservación de
  las tres relaciones al pasar de `lead` a `client`.
- ✅ Perfil Comercial sin acceso a precios, facturas, costes ni margen: el
  backend resuelve `finance.read/manage` y el frontend consume esas señales
  canónicas para navegación y rutas financieras. La prueba E2E autenticada
  confirma acceso a Clientes y redirección desde Presupuestos, Facturas,
  Gastos, registros y resúmenes fiscales, Analítica y Calendario fiscal.

### Fase 3 — Catálogo, presupuestos y contratos

- ✅ Presupuestos, líneas, facturas, snapshots fiscales y rectificaciones ya
  existen y se conservan.
- ✅ Catálogo único de servicios y versiones: cada servicio conserva duración
  estimada y requisitos, publica un historial inmutable y los trabajos creados
  desde catálogo quedan vinculados a la versión exacta seleccionada. Cubierto
  con migración reversible, aislamiento entre empresas y pruebas de regresión,
  más validación E2E autenticada local en `v1.6.1`.
- ✅ Revisiones y aprobaciones de presupuesto: cada envío genera una versión
  inmutable; cualquier cambio posterior exige crear una revisión editable. La
  aceptación queda ligada a la versión enviada y el historial es visible desde
  el detalle. Cubierto con migración reversible, aislamiento entre empresas y
  pruebas de regresión y validación E2E autenticada local en `v1.6.1`.
- ✅ Contratos, SLA, renovaciones, servicios contratados y ubicaciones cubiertas:
  al aceptar un presupuesto se crea un contrato borrador con las líneas
  inmutables de la revisión aceptada; permite fijar SLA, vigencia y renovación,
  cubrir únicamente ubicaciones activas del mismo cliente y activarlo tras esa
  comprobación. Cubierto con migración reversible y pruebas de autorización,
  aislamiento, servicio y ubicación cubierta, más validación E2E autenticada
  local en `v1.6.1`.
- ✅ Regla presupuesto aceptado → contrato; nunca crear un trabajo directamente:
  la aceptación crea como máximo un contrato borrador por presupuesto y no toca
  `TaskItem`; el contrato requiere una activación explícita tras fijar sus
  ubicaciones. Cubierto con regresiones y validación E2E autenticada local en
  `v1.6.1`.

### Fase 4 — Ubicaciones Enterprise

- ✅ Ubicaciones, perfiles operativos, zonas y acceso protegido ya existen.
- ✅ La interfaz de Ubicaciones y el acceso rápido desde Clientes existen.
- 🟡 Contactos operativos por ubicación: cada local puede tener varias personas
  para operaciones, acceso, calidad o emergencias, con un contacto principal;
  no se confunden con los contactos comerciales o de facturación de la cuenta.
  Cubierto con migración reversible, aislamiento entre empresas, regresiones y
  E2E autenticada local; pendiente de revisión visual autenticada y publicación
  para marcarlo como completado.
- 🟡 Riesgos operativos por ubicación: el local puede mantener riesgos abiertos
  o mitigados, con severidad, instrucciones y medida preventiva. Está
  integrado en los tres flujos canónicos de alta/edición, con migración
  reversible, regresiones de aislamiento y E2E autenticada local; pendiente de
  revisión visual autenticada y publicación para marcarlo como completado.
- 🟡 Horarios de servicio por ubicación: se guardan separados de las
  credenciales/horarios de acceso, por días, franja y estado. Están disponibles
  al crear o editar en el espacio interno, portal patrocinado y alta inicial;
  cubiertos con migración reversible, regresiones de aislamiento y E2E
  autenticada local. Pendiente de revisión visual autenticada y publicación
  para marcarlo como completado.
- 🟡 Documentos y equipos normalizados por ubicación: documentos privados PDF,
  JPEG y PNG con hash, cuota documental por empresa: 1 MB en Basic/Medium y 10 MB
  en Top/Enterprise; inventario
  con estado, cantidad y mantenimiento. Lectura por ámbito y altas/archivo solo
  para la empresa propietaria con `locations.manage`; migración y regresiones
  cubiertas, con E2E autenticada local de alta y archivo. Vistas independientes
  de Documentos y Activos, sin mezclarlas con Ubicaciones. Pendiente de revisión
  visual autenticada y publicación.
  Servicios contratados quedan cubiertos por la relación formal de contratos
  siguiente.
- 🟡 Relación formal cliente → contrato → ubicación → zona: un contrato nace
  de la revisión aceptada, solo puede cubrir ubicaciones activas de su cliente y
  puede restringirse a zonas activas de esas ubicaciones; sin zonas elegidas,
  cubre la ubicación completa. Cubierto con migración reversible, aislamiento,
  regresiones y E2E autenticada local; pendiente de revisión visual autenticada
  y publicación para marcarlo como completado.

### Fase 5 — Órdenes, recurrencia y tiempo

- ✅ Trabajos actuales, asignaciones, checklist, evidencias, calendario y
  sesiones de trabajo/fichaje existen.
- ✅ Los trabajos facturables pueden seleccionarse para crear facturas.
- ✅ Modelo `work_orders` separado de `TaskItem`: una orden individual o
  recurrente puede vincularse a un contrato activo y generar tareas
  ejecutables trazables sin alterar tareas existentes. Publicado en `v1.6.1`;
  la UI permite crear, replanificar, pausar, reactivar y generar ejecuciones,
  validado con E2E autenticada local.
- ⬜ Previsión de personas/minutos, pausas, GPS final, correcciones justificadas,
  aprobaciones, partes y coste laboral.

### Fase 6 — Calidad e incidencias

- ✅ Plantillas de inspección, inspecciones, puntuaciones, incidencias y
  acciones correctivas con ámbitos por empresa y ubicación están publicados
  en `v1.6.1`. La UI de plantillas, inspecciones, puntuación, incidencias y
  creación o cierre de acciones correctivas está validada con E2E autenticada
  local; la cancelación está cubierta por la regresión backend.
- ⬜ Fotos, firmas y reclamaciones siguen sin iniciar.

### Fase 7 — Material, compras y activos

- ✅ Gastos básicos existen.
- 🟡 Base de inventario: proveedores, catálogo de material, almacenes,
  movimientos inmutables y saldo calculado por almacén. Cubierta con migración
  reversible, permisos por empresa, aislamiento, regresiones y recorrido API
  autenticado local. Interfaz local de stock, materiales, proveedores,
  almacenes y movimientos integrada y validada sin navegador; pendiente de
  revisión visual autenticada y publicación.
- 🟡 Flujo de compra de material local: la cabecera usa un proveedor del
  directorio y conserva su snapshot fiscal; sus líneas crean entradas
  inmutables y un único gasto fiscal con IVA, pago y justificante. Finanzas
  cuenta solo el gasto; una corrección crea movimientos de ajuste, archiva el
  gasto enlazado y bloquea su edición/borrado directo. Backend, migración y UI
  local validados sin navegador; pendiente de revisión visual autenticada y
  publicación.
- 🟡 Lotes, activos operativos y consumo por orden local: los activos ya se
  administran por ubicación, separados del stock. Una recepción puede crear
  un lote con caducidad y saldo propio; una orden de trabajo registra su
  consumo como salida inmutable y una corrección añade la entrada inversa una
  sola vez. Backend, migración y UI local validados sin navegador; pendiente
  de revisión visual autenticada y publicación.

### Fase 8 — Cobros, margen y analítica

- ✅ Facturación, registros fiscales y resúmenes financieros básicos existen.
- 🟡 Cobros: recibos de cliente inmutables con reparto entre facturas, saldo no
  aplicado y anulación auditable; actualizan el estado de cobro sin alterar el
  registro fiscal ni el IVA. Validado por API y UI local; pendiente de revisión
  visual autenticada.
- ✅ Coste laboral interno con históricos inmutables por sesión y rentabilidad
  conocida por cliente a partir de ingresos y gastos asignados.
- 🟡 Conciliación bancaria manual: apuntes de extracto inmutables, vínculo de
  importe exacto con un único cobro y reversión auditada. No crea ingresos ni
  altera IVA; un cobro conciliado exige deshacer el vínculo antes de anularse.
  Backend, migración y UI local validados sin navegador; pendiente de revisión
  visual autenticada e importación bancaria.
- ⬜ Imputación de material/subcontrata y margen previsto frente a real, sin
  duplicar compras de inventario como gasto.
- 🟡 Analítica financiera y de rentabilidad por cliente existen con permisos de
  lectura; faltan cortes homogéneos por sociedad, delegación, contrato,
  ubicación, servicio, equipo y trabajo.

### Fase 9 — Portales e integraciones

- ✅ Colaboración externa y Google Calendar existen de forma parcial.
- ✅ Base de portal de gestoría: acceso externo por empresa, revocable y de
  solo lectura financiera, sin plaza ni membresía interna.
- ✅ Portal de inmobiliaria existente: acceso patrocinado revocable, sin plaza
  interna ni dashboard completo; propiedades propias y solicitudes al
  proveedor anfitrión están aisladas por backend. La inmobiliaria puede crear
  propiedades propias, compartidas automáticamente solo con su anfitriona,
  editarlas o archivarlas; las solicitudes solo se modifican antes de iniciar
  el trabajo o facturarlo. Validado con E2E autenticada local en `v1.6.1`.
- ✅ Alta patrocinada de inmobiliaria nueva: invitación de un solo uso,
  empresa sin plan, colaboración aceptada y grant inicial sin plaza interna.
  Validada con E2E autenticada local en `v1.6.1`.
- ✅ Red externa: navegación común con tabs de colaboradores operativos y
  accesos profesionales; conserva modelos y autorización separados. Validada
  con navegación E2E autenticada local en `v1.6.1`.
- ⬜ Portal de cliente y selector de varias empresas para personas externas.
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

1. Completar Ubicaciones Enterprise; después material, cobros/margen y
   portales, en ese orden.
2. Retomar Stripe solo cuando los contratos, el responsable legal y los precios
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
