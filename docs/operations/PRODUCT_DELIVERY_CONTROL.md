# WorkHive — control completo de plan y entregas

Actualizado: 2 de septiembre de 2026.

Este es el documento de control de este ciclo. Une las decisiones de producto,
lo que realmente se ha construido y el roadmap pendiente. El documento de
referencia para la visión completa de WorkHive es
[`WORKHIVE_UNIFIED_PRODUCT_ROADMAP.md`](../engineering/WORKHIVE_UNIFIED_PRODUCT_ROADMAP.md).

## Cómo leer el estado

- ✅ Hecho, probado y validado por producto. Se indica si ya está en producción
  o si permanece solo en `main` local.
- ⬜ Pendiente. No se debe considerar comprometido ni asumir que existe en la
  aplicación.
- Sin check: fase parcialmente realizada; el texto concreta qué parte está
  hecha y qué no.

## Estado de código y publicación

- ✅ **Producción:** versión `v1.5.3`, publicada desde `9c76b6d`.
- ✅ **Validado localmente:** `07e0e83` — lenguaje de seguimiento comercial y
  paginación de documentos. La revisión visual fue aprobada el 2 de septiembre.
- ⬜ **Pendiente de orden de publicación:** enviar `07e0e83` a GitHub y crear
  el siguiente despliegue. No se ha enviado nada remoto tras esta validación.
- ✅ No hay ramas de trabajo locales ni remotas que fusionar o eliminar: solo
  existe `main` y `origin/main`.

## Decisiones de producto cerradas en este ciclo

### Sistema visual y responsive

- ✅ Todo control nuevo usa el sistema local basado en shadcn/ui: `Dialog`,
  `Button`, `Input`, `Select`, `Checkbox`, `DatePicker`, `Table`, `Card`,
  `Pagination` y `PremiumTabs`.
- ✅ Escritorio: las listas de negocio usan `Table` de shadcn; móvil: la misma
  información se presenta con `Card` de shadcn, sin scroll horizontal.
- ✅ Métricas y tarjetas siguen cuadrícula de dos columnas en móvil; si hay un
  número impar, la última no se estira artificialmente.
- ✅ Pestañas: hasta cuatro opciones se mantienen en una fila; con más de
  cuatro, móvil muestra un selector y deja espacio con el contenido.
- ✅ Diálogos con cabecera y pie translúcidos, sin barras blancas sólidas;
  campos y calendarios comparten las superficies de la aplicación.

### Empresa, planes y seguridad

- ✅ Catálogo de planes versionado: Basic, Medium, Top y Enterprise, con
  capacidades, funciones y precios mensual/anual preparados en el dominio.
- ✅ Las empresas pueden recibir una excepción personalizada de funciones o
  límites sin modificar el plan estándar de los demás clientes.
- ✅ Cambiar plan, condiciones, límites o funciones exige un diálogo de
  confirmación comercial; los cambios sensibles quedan preparados para
  auditoría.
- ✅ Planes, límites, funciones activas y perfiles de acceso están separados de
  la UI y se aplican por empresa.
- ✅ La interfaz de superadministración usa una única convención de tabs,
  checkbox, filtros, tablas, tarjetas y paginación.
- ⬜ Definir y aprobar el precio comercial de cada ampliación o funcionalidad
  personalizada. El modelo técnico existe, pero la política de tarifas todavía
  es una decisión de negocio.
- ⬜ Panel comercial de superadministración con MRR, empresas activas,
  impagos, upgrades, churn e ingresos por plan. No se ha creado todavía para
  no inventar analítica antes de cerrar el cobro real.

### Organización, personas e invitaciones

- ✅ Departamentos, equipos, personas y perfiles de permisos tienen vistas
  desktop con tabla y móvil con tarjetas; los menús de acciones se mantienen en
  la esquina superior derecha de cada tarjeta.
- ✅ Los departamentos se pueden eliminar únicamente cuando no tienen datos
  relacionados; si los tienen, se conserva la integridad y se explica el
  bloqueo.
- ✅ Invitaciones: se muestran pendientes y recientes con estado; se pueden
  cancelar o revocar y los enlaces se validan antes de crear acceso.
- ✅ Los permisos sensibles de empresa se protegen en la interfaz y se aplican
  dentro de la empresa correspondiente; no dan acceso a superadministración ni
  a datos de otra empresa.
- ✅ Formularios de invitación, creación de contraseña y controles de permisos
  se migraron a los componentes compartidos de shadcn.
- ⬜ Flujo completo y formal de derecho de supresión de datos: solicitud del
  usuario, revisión por la empresa responsable, retención obligatoria de datos
  operativos y decisión final de superadministración. El criterio está
  identificado, pero falta convertirlo en flujo legal, UI y auditoría
  verificable.

### Clientes, relación comercial y documentos

- ✅ Espacio de Clientes: filtros, tabla de escritorio, tarjetas móviles,
  paginación, ficha del cliente, ubicaciones, trabajos, facturas y contactos
  comparten el sistema visual de Organización.
- ✅ Se eliminó información duplicada de la ficha y las acciones de editar y
  menú contextual están separadas y operativas.
- ✅ Un cliente puede tener contactos y actividad asociada sin confundirlos con
  usuarios internos de WorkHive.
- ✅ El antiguo término técnico de CRM **Oportunidad** se muestra ahora como
  **Seguimiento comercial**. La acción es **Nuevo seguimiento** y el formulario
  pide: **Asunto**, **Situación**, **Responsable**, **Persona de contacto** y
  **Próximo paso**.
- ✅ Un seguimiento sirve para registrar una conversación, visita o propuesta
  potencial y su actividad. No es un presupuesto, una factura ni un cobro; al
  formalizar un importe se usa Presupuestos.
- ✅ Facturas y Presupuestos usan la paginación común, encabezados azules y
  separadores de filas; en móvil siguen presentándose como tarjetas.
- ✅ Trabajos facturables en móvil usan tarjetas, checkbox de shadcn y contenido
  reordenado para que fecha, importe, estado y asignación no se solapen.
- ⬜ Convertir un prospecto en cliente sin duplicar datos y definir una cartera
  visible por responsable comercial. El seguimiento actual es la base, no el
  flujo completo de prospectos.
- ⬜ Relacionar un presupuesto aceptado con un contrato. No debe crear trabajos
  directamente.

### Cobro y Stripe

- ✅ Se dejó diseñado el catálogo comercial público, la selección mensual/anual,
  el intento de compra, la sesión de Checkout alojada, el webhook y la
  activación posterior al pago.
- ✅ Se configuraron productos y precios de prueba en Stripe para Basic, Medium
  y Top; las claves y los Price IDs no se guardan en el repositorio.
- ✅ La política actual es **no activar cobros todavía**:
  `BILLING_ENABLED=false`. No bloquea Organización, Clientes, Presupuestos ni
  Facturas.
- ⬜ Configurar la entidad legal que cobrará: razón social, NIF/CIF, dirección,
  representante, cuenta bancaria, soporte y descriptor bancario.
- ⬜ Configurar en local los secretos sandbox, ocho Price IDs y el listener de
  Stripe; probar Checkout, webhook, provisión, cancelación, impago y
  reactivación con una empresa de prueba.
- ⬜ Pasar a producción solo después de esas pruebas y de configurar la entidad
  legal en Stripe. Nunca se suben secretos, webhook secrets ni Price IDs al
  repositorio.

## Roadmap completo y estado real

### Fase 0 — Acordar antes de programar

Hecho: se adoptó el sistema shadcn, el patrón responsive, el aislamiento por
empresa, la estrategia de planes y el aplazamiento consciente de Stripe.

Pendiente: fijar con negocio la tabla de precios de ampliaciones, la política
legal de borrado de datos y una empresa de prueba grande que cubra todos los
casos de uso.

### Fase 1 — Base para empresas grandes

Hecho: departamentos, equipos, perfiles, invitaciones, controles de acceso,
planes, límites, funciones y confirmaciones de cambios sensibles.

Pendiente: terminar la migración gradual de los roles heredados y completar el
flujo legal/auditable de supresión de personas.

### Fase 2 — Clientes y ventas

Hecho: clientes, contactos, ficha completa, seguimiento comercial y actividad
de seguimiento.

Pendiente: prospectos como estado de una misma ficha, conversión segura a
cliente, cartera por comercial y validación completa de los permisos de
Comercial frente a Finanzas.

### Fase 3 — Servicios, presupuestos y contratos

Hecho: presupuestos y facturas básicas, edición de conceptos, impuestos,
direcciones fiscales y listas responsivas paginadas.

Pendiente: catálogo reutilizable de servicios, versiones, aprobaciones,
precios protegidos, contratos, SLA, renovaciones y vínculo presupuesto
aceptado → contrato.

### Fase 4 — Ubicaciones

Hecho: ubicaciones de cliente visibles desde Clientes y vinculadas a trabajos.

Pendiente: perfil completo de ubicación con zonas, responsables, horarios,
documentos, riesgos, accesos, equipos y servicios contratados.

### Fase 5 — Trabajos, planificación y tiempo

Hecho: trabajos, asignaciones, calendario, recurrencias básicas, fichajes,
checklists, evidencias y selección de trabajos facturables.

Pendiente: planificación completa de capacidad, previsión frente a tiempo
real, pausas, correcciones justificadas, aprobaciones y coste laboral
consolidado.

### Fase 6 — Calidad e incidencias

⬜ Pendiente: inspecciones, puntuación, evidencias, firma, incidencias,
reclamaciones y acciones correctivas.

### Fase 7 — Material, compras, gastos y activos

Hecho: gastos básicos.

Pendiente: proveedores, compras, inventario, stock, material de equipos,
activos y atribución de consumos a cada trabajo.

### Fase 8 — Cobros, margen y analítica

Hecho: resúmenes financieros y facturas básicas.

Pendiente: cobros, cobros parciales, conciliación, costes por trabajo, margen
previsto frente a real e informes limitados por permiso.

### Fase 9 — Portales, automatizaciones e integraciones

⬜ Pendiente: portal de cliente, portal de partner/inmobiliaria, portal de
gestoría, aplicación ampliada de trabajador, API pública, integraciones y
automatizaciones auditables.

## Siguiente orden de trabajo recomendado

1. Publicar el commit local validado cuando se autorice.
2. Cerrar la parte pendiente de Fase 2: prospecto → cliente sin duplicación y
   cartera por responsable, incluyendo permisos de Comercial.
3. Pasar a Fase 3: catálogo de servicios y contrato; no ampliar Stripe antes
   de disponer de esta propuesta comercial y de la entidad legal.
4. Volver a Stripe únicamente cuando el bloque de cobro tenga responsable
   legal, datos de cuenta y escenarios de soporte definidos.

## Regla de control para cada entrega

1. Definir alcance, datos, permisos y criterio de aceptación antes de editar.
2. Añadir o ajustar pruebas del comportamiento y de aislamiento entre empresas.
3. Ejecutar pruebas focalizadas y, si cambia frontend, tests completos, tipos,
   lint, build y React Doctor.
4. Probar el flujo real con datos de prueba en local.
5. Hacer un commit de una sola funcionalidad, revisar, publicar y verificar en
   producción antes de convertir el punto en ✅ publicado.
