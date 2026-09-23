# WorkHive — plan maestro de dominio, producto y entregas

Actualizado: 23 de septiembre de 2026.

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

- ✅ Producción: `v1.6.6` (`ee738b3`), publicada desde `main` con imágenes
  inmutables en ECR y despliegue SSM verificado. Backend, frontend, React
  Doctor, SAST, secretos y GitGuardian terminaron correctamente.
- ✅ `main` local y `origin/main` están alineadas en `ee738b3`; incluye las
  fases operativas, financieras y el gobierno comercial de plataforma. La
  asociación semanal, agente CloudWatch y alarma se aplican en AWS como paso
  operativo separado.
- ✅ Seguimiento comercial y la paginación de Facturas y Presupuestos están
  publicados; el cambio inicial fue `07e0e83`.
- ✅ Documentación unificada: este documento sustituye blueprint, roadmap y
  control de entregas duplicados; los runbooks operativos se conservan.

## 3. Decisiones cerradas

### UI, accesibilidad y responsive

- ✅ Componentes comunes: `Dialog`, `Button`, `Input`, `Textarea`, `Select`,
  `Checkbox`, `Switch`, `DatePicker`, `Table`, `Card`, `Pagination` y
  `PremiumTabs`.
- ✅ Diálogos con cabecera y pie translúcidos, sin blanco sólido.
- ✅ Listas de negocio: tabla shadcn en escritorio y tarjetas shadcn en móvil.
- ✅ Métricas: dos columnas en móvil; una tarjeta impar no se estira.
- ✅ Tabs: escritorio puede mostrarlas en fila; tablet y móvil siempre las
  compactan en el mismo selector desplegable, con la misma cantidad, orden y
  reglas de visibilidad de opciones que el escritorio. `PremiumTabs` aplica la
  regla a cualquier número de pestañas y tiene regresiones para impedir volver
  al umbral antiguo de más de cuatro.
- 🟡 Las superficies nuevas y modificadas usan exclusivamente tokens semánticos
  de `globals.css` para estado, prioridad y alerta, además de los componentes
  locales basados en shadcn/ui. El margen operativo y las pantallas técnicas
  de checklist, incidencias y propiedades ya se ajustaron a esta regla; queda
  auditar y corregir los controles heredados fuera de esos cortes.
- 🟡 Fechas: todos los formularios usan los `DatePicker` y `DateTimePicker`
  compartidos de Facturación; una regresión impide reintroducir controles
  nativos de fecha o fecha/hora. Los límites mínimos/máximos y el borrado
  opcional se mantienen en el componente común. Validado localmente con tests,
  typecheck y lint; pendiente de revisión visual autenticada.
- 🟡 Inputs y selectores heredados: los filtros de Operación (reservas, tareas
  propias y solicitudes) ya usan un selector shadcn/ui compacto compartido, y
  los editores de tareas usan `Input`/`Select` locales para precio, cantidad,
  estado, prioridad, unidad y reservas opcionales, y los filtros de calendario
  también usan los controles compartidos. Ubicaciones ya usa esos controles en
  sus filtros, alta de espacios, espacio padre e historial de trabajo, y
  Gastos usa `Input`, `Select` y el mismo `DatePicker` de Facturas para sus
  filtros. El envoltorio heredado `DocumentFormSelect`, que generaba un control
  nativo, fue retirado: Gastos, usuarios, colaboradores e invitaciones usan el
  `Select` canónico. Los filtros de año de Resumen fiscal y Libro de ventas, y
  los controles de configuración de Facturae, también reutilizan las
  primitivas canónicas; el editor de checklist de tareas también las usa para
  asignaciones masivas e individuales y la creación de tareas para checklist,
  plantilla, asignación y precio. El espacio técnico de checklist, incidencias,
  comentarios, adjuntos y propiedades ya usa las primitivas canónicas, sin
  lecturas directas del DOM al guardar propiedades. Ya no quedan `<select>`
  nativos en código de producto; todos los selectores de archivo se mantienen
  como una capacidad obligatoria del navegador, envueltos por `Input`. Los
  formularios públicos de recuperación, contacto y aceptación del portal de
  cliente también usan `Input`, `Textarea` y `Checkbox` compartidos. El último
  corte sustituye los campos heredados de calendario fiscal, correo de factura,
  plantillas y espacios de ubicación, edición de tareas, reservas, privacidad,
  informes técnicos y la integración de calendario; el interruptor de esta
  última usa ahora `Switch`. Ya no quedan `<input>`, `<textarea>` ni `<select>`
  visuales en código de producto fuera de las primitivas que los implementan.
  Se preservan valores vacíos, filtros, validaciones y permisos. Los controles
  de solo hora se mantienen separados porque no representan un calendario.
  Validado localmente con regresiones; queda la revisión visual autenticada para
  cerrar el punto.
- 🟡 Botones heredados: Ubicaciones, Gastos y el centro de Informes técnicos ya
  sustituyen por `Button` las acciones ordinarias —alta, selección, edición,
  borrado, paginación, creación, revisión, tipo de local, horario de acceso,
  habitaciones, servicios fijados y notas—, incluyendo acciones destructivas con el token
  semántico `dangerSoft`. Se preservan los controles de selección con
  `aria-pressed`, los nombres accesibles de los botones de icono y los botones
  compuestos que abren una tarjeta completa. Queda completar la misma auditoría
  por los demás dominios y la revisión visual autenticada.
- 🟡 Navegación unificada: sidebar shadcn responsive con rail de escritorio,
  Sheet móvil, grupos de dominio compactos, perfil en el pie y tooltips; las
  rutas, filtros de rol y entitlements existentes se conservan. El componente
  compartido y sus regresiones de navegación, capas móviles y portales están
  validados localmente; falta la validación visual autenticada final.

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
- 🟡 Política de ampliaciones y funcionalidades Custom: parte siempre de un
  plan estándar activo; no es una compra automática ni puede ampliar una
  prueba. El superadmin debe registrar o reutilizar un snapshot de condiciones
  comerciales, y cada sustitución o excepción queda auditada con motivo y
  vencimiento opcional. Cubierto localmente con autorización positiva y
  negativa; pendiente de publicación y de validación visual autenticada.
- 🟡 Panel comercial de superadmin: MRR, activas, impagos, upgrades, churn e
  ingresos por plan. Publicado en `v1.6.6`; pendiente de validación visual
  autenticada tras el despliegue.

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
- 🟡 Empresa demo Enterprise: `backend/scripts/seed_demo.py` solo reconstruye
  una SQLite explícita dentro de `backend/storage/demo`, nunca la base normal
  ni producción. Crea plan Enterprise (`mega`) activo con términos comerciales
  ficticios, departamentos, equipos, perfiles con scopes, usuarios y dos
  ubicaciones; los correos usan `.invalid` y no hay datos de clientes reales.
  Está cubierta por regresiones de aislamiento y de coherencia; falta ejecutarla
  y validarla visualmente en el entorno local de demostración.
- ✅ Inventario definitivo de compatibilidades API y de datos a migrar:
  `docs/engineering/API_AND_DATA_COMPATIBILITY_INVENTORY.md` delimita la
  superficie `/api/v1`, la API pública con clave, los clientes web y las
  transiciones de plan, membresías, accesos externos, contactos, reservas y
  documentos. Un test obliga a revisar el inventario al registrar un prefijo
  nuevo. Antes de retirar cualquier compatibilidad sigue siendo obligatoria la
  comprobación de pendientes y un backfill controlado en el entorno objetivo.
- ✅ Catálogo único revisado de módulos, permisos y clases de plaza:
  `docs/engineering/MODULE_PERMISSION_SEAT_CATALOG.md` separa módulos de
  plan, permisos y scopes, plazas internas y grants externos; define qué
  recibe realmente un administrador y evita que un módulo `coming_soon` se
  venda por figurar en un plan técnico. Un test obliga a documentar cada
  entitlement, cuota, permiso base y permiso reservado nuevo.
- 🟡 Endurecer el almacenamiento documental: los PDFs, Facturae y certificados
  fiscales por empresa nuevos ya usan claves opacas de objeto con tipo, tamaño
  y hash. Una migración manual por empresa
  (`backend/scripts/migrate_legacy_documents.py`) inspecciona primero,
  verifica contenido y hash, copia y vuelve a leer el objeto antes de retirar
  solo la ruta heredada de la base; el fichero origen no se borra. Está
  cubierta localmente para PDF, XML y PKCS#12, incluido el rechazo de un hash
  alterado. El certificado global de firma Facturae ya admite AWS Secrets
  Manager mediante una referencia de configuración: lee un JSON con
  `pkcs12_base64` y `password`, materializa el PKCS#12 con permisos `0600` solo
  mientras firma y conserva el archivo como compatibilidad local. Las rutas
  ambiguas (secreto y archivo a la vez) se rechazan y un fallo del gestor
  devuelve un `503` genérico sin filtrar material sensible. Falta crear el
  secreto real, limitar el rol de producción a `secretsmanager:GetSecretValue`
  sobre ese secreto, ejecutar la migración controlada sobre datos reales y
  confirmar la retención/versionado y copia verificable del bucket de
  producción. La separación entre el bucket de documentos y el bucket de
  backups, junto con sus controles de acceso, versionado, ciclo de vida y
  validación, está preparada en
  `docs/operations/PRODUCTION_DOCUMENT_STORAGE_RUNBOOK.md`; sigue pendiente
  aplicarla y verificarla en AWS.
  `backend/storage` es solo dato local ignorado por Git, no una fuente de
  verdad ni un lugar para secretos.

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
- 🟡 Previsión de personas/minutos, pausas auditables, GPS final,
  correcciones justificadas con aprobación, partes de trabajo y coste laboral:
  las órdenes conservan la previsión; los fichajes restan pausas y registran
  coordenadas finales; las correcciones son revisables y no alteran tiempo ya
  facturado; los partes están separados de la tarea y el coste queda congelado
  al cerrar la sesión. Publicado en `v1.6.5` y validado con 45 regresiones
  backend y 15 pruebas frontend focalizadas; pendiente de revisión visual
  autenticada para cerrar la fase.

### Fase 6 — Calidad e incidencias

- ✅ Plantillas de inspección, inspecciones, puntuaciones, incidencias y
  acciones correctivas con ámbitos por empresa y ubicación están publicados
  en `v1.6.1`. La UI de plantillas, inspecciones, puntuación, incidencias y
  creación o cierre de acciones correctivas está validada con E2E autenticada
  local; la cancelación está cubierta por la regresión backend.
- 🟡 Fotos de evidencia privadas para inspecciones e incidencias están listas
  localmente: se almacenan por empresa y ubicación, se descargan solo por sus
  rutas autorizadas y el cargador genérico las rechaza. Todas las cargas de
  foto se comprimen en el navegador con objetivo de 850 KB y el servidor
  impone un máximo uniforme de 1 MB. Falta validación visual autenticada y
  publicación.
- 🟡 La conformidad interna de una inspección cerrada está lista localmente:
  se registra una única confirmación inmutable, con persona, versión de texto
  y fecha, y exige permiso de gestión de la ubicación. No sustituye una firma
  legal. Faltan validación visual autenticada y publicación.
- 🟡 La aceptación del cliente o su representante está lista localmente en el
  portal autorizado: solo ve inspecciones cerradas de sus ubicaciones, no
  notas ni evidencias internas, y registra una única aceptación con cuenta,
  nombre, fecha, versión y huella del resumen revisado. No es una firma
  electrónica cualificada. Faltan validación visual autenticada y publicación.
- 🟡 Reclamaciones de cliente separadas de incidencias: el cliente puede abrir
  expedientes solo para sus ubicaciones autorizadas desde su portal y consultar
  el estado o la respuesta publicada; el equipo los tramita con permisos y
  ámbitos por ubicación, conservando notas internas privadas. La creación,
  resolución, auditoría, aislamiento entre cliente–empresa y no exposición de
  notas internas están cubiertos localmente con migración, pruebas, typecheck,
  lint, build y React Doctor; faltan validación visual autenticada y
  publicación.

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
- 🟡 Imputación de material: el consumo por orden conserva el coste medio
  ponderado disponible y el cliente de la ubicación como snapshots inmutables;
  una corrección queda fuera del margen y un coste no trazable no se estima.
  La compra sigue siendo un gasto fiscal, pero se excluye del margen de cliente
  hasta que el stock se consume, evitando el doble conteo. Backend, migración y
  UI local validados sin navegador; pendiente de revisión visual autenticada.
- 🟡 Subcontrata: Gastos incorpora la categoría operativa `subcontracting`; al
  asignarla a un cliente ya entra como coste directo en la rentabilidad, con el
  mismo IVA, pago, justificante y edición de Gastos. Puede imputarse además a
  un contrato o a una orden (nunca a ambos): el backend confirma el cliente del
  alcance y rechaza referencias de otra empresa. Se mantiene separada del
  inventario y no crea stock. Validada por tests y UI local sin navegador;
  pendiente de revisión visual autenticada.
- 🟡 Margen previsto frente a real: hay presupuesto de coste explícito por
  contrato u orden, con la oferta aceptada como ingreso previsto del contrato
  y coste/ingreso trazado desde tareas facturadas, fichajes con snapshot y
  material consumido no revertido. Incluye los gastos directamente vinculados
  al contrato o a sus órdenes; las compras de inventario continúan fuera hasta
  que se consume el stock, evitando doble conteo. Los gastos generales
  —incluidos los solo asignados a cliente— no se reparten ni se inventan.
  Backend, migración SQLite, UI local y regresiones de autorización validados
  sin navegador; pendiente de revisión visual autenticada.
- 🟡 Analítica financiera y de rentabilidad por cliente existen con permisos de
  lectura. El corte operativo permite consultar el margen previsto frente al
  real de un contrato o de una orden, sin repartir ingresos ni costes entre
  alcances: solo muestra facturas de tareas, mano de obra con snapshot,
  material consumido y gastos directos ya vinculados. También ofrece el margen
  real por ubicación: reconoce únicamente tareas facturadas, sesiones
  registradas allí, material consumido por sus órdenes y gastos directos de
  esas órdenes; no reparte gastos generales, compras de inventario ni importes
  de contratos compartidos. También permite el margen conocido por versión de
  servicio: incluye solo facturas de tareas y mano de obra con snapshot
  vinculadas a esa versión inmutable; material y gastos no se reparten mientras
  sigan vinculados solo a una orden o contrato. La pestaña exige los permisos
  financieros y de costes laborales y reutiliza el cálculo protegido del
  backend. UI local y regresiones de frontend validadas sin navegador. También
  ofrece coste laboral trazado por equipo: cada fichaje cerrado congela
  el equipo responsable de su ubicación y no se reescribe si cambian equipos o
  asignaciones; solo suma sesiones con coste conocido y no inventa un margen
  de equipo. Los fichajes históricos sin ese snapshot quedan sin equipo. UI
  local, migración y regresiones de autorización validadas sin navegador;
  pendientes de revisión visual autenticada y de cortes homogéneos por
  sociedad y delegación, además de la futura imputación explícita de
  material/gastos a una tarea.

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
- 🟡 Portal de cliente y selector de varias empresas para personas externas:
  invitación de un solo uso y grant revocable por cliente–empresa, sin plaza ni
  membresía interna; una persona puede seleccionar solo sus espacios
  documentales concedidos. El portal expone únicamente presupuestos enviados,
  contratos, facturas, inspecciones cerradas y reclamaciones de las ubicaciones
  del cliente, con PDF protegido y sin costes, márgenes ni notas privadas.
  Cubierto localmente con migración, permisos positivos,
  denegación, aislamiento entre clientes/empresas, tests de interfaz,
  typecheck, lint y build; pendiente de revisión visual autenticada para
  marcarlo como completado.
- 🟡 API pública inicial: gestión de claves por administrador, revocables y
  mostradas solo al emitirlas; consulta de órdenes de trabajo y entrada de
  reservas mediante contratos con alcance explícito. La entrada de reservas es
  idempotente por empresa, fuente y referencia externa; reutiliza las
  validaciones de capacidad, solapes, limpieza y tareas, sin permitir cambiar
  la ubicación ni cruzar empresas. Todos los usos quedan limitados por
  frecuencia y suscripción y auditados sin guardar el secreto. Cubierto
  localmente con migración, permisos, denegación, aislamiento, reintentos,
  historial administrativo por clave, typecheck, tests, lint focalizado y
  build; pendiente de revisión visual
  autenticada y de un contrato de integración real antes de marcarlo como
  completado.
- 🟡 Ampliación de aplicación de trabajador e integraciones auditables: la
  aplicación de trabajador ya cubre asignación, checklist, inicio, pausa,
  cierre, evidencias e incidencias. Para la API pública, cada administrador
  puede consultar los últimos usos de cada clave sin exponer secretos ni IP;
  queda pendiente validar ese historial autenticado y definir el siguiente
  contrato de integración real antes de cerrar esta línea.
- 🟡 Automatizaciones seguras para vencimientos, avisos y aprobaciones reales:
  recordatorios de prueba, cobro y calendario fiscal se ejecutan bajo bandera
  de configuración y no cambian por sí mismos el estado fiscal de una factura.
  La deduplicación de avisos ya es persistente por destinatario y evento, por
  lo que reintentos y procesos simultáneos convergen en una sola notificación.
  Cubierto localmente con migración, idempotencia y pruebas de destinatarios;
  pendiente de validación operativa en el despliegue y de ampliar las
  aprobaciones de negocio antes de marcarlo como completado.

### Fase 10 — Gobierno comercial de plataforma

- 🟡 Resumen comercial para superadmin: muestra suscripciones activas, pruebas,
  cobros a revisar, upgrades, downgrades, bajas y distribución por plan desde
  el historial de suscripciones y auditorías. Es solo lectura, no es accesible
  para administradores de empresa y no mezcla finanzas de clientes con la
  suscripción de WorkHive. Publicado en `v1.6.6`; pendiente de validación
  visual autenticada tras el despliegue.
- ✅ Términos comerciales inmutables por suscripción: toda activación pagada
  nueva, ya sea provisión de plataforma, cambio manual de plan o compra
  confirmada, guarda importe, EUR, intervalo, tratamiento de IVA y fecha
  efectiva en un snapshot. Un cambio de condiciones cierra el registro previo
  y abre otro; el historial manual sin condiciones sigue siendo desconocido y
  queda excluido. El MRR es contractual, no ingreso cobrado: normaliza anual a
  mensual y nunca mezcla monedas sin tipo de cambio inmutable. La ruta genérica
  de empresa no puede eludir este flujo. Cubierto localmente con migración,
  autorización positiva/negativa, compra, provisión, histórico y regresiones;
  publicado en `v1.6.6` y pendiente de validación visual autenticada tras el
  despliegue.

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
