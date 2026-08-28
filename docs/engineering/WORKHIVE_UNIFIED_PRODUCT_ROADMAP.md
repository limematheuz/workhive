# Plan completo de WorkHive: de la aplicación actual a una plataforma Enterprise

> Este es el documento que se usará para explicar el camino al equipo. Resume
> cómo funciona WorkHive hoy, qué se va a conservar, qué se va a mejorar y el
> orden de trabajo. No cambia nada todavía: cada fase se aprobará, se probará y
> se revisará antes de empezar la siguiente.

## 1. La idea en una frase

WorkHive pasará de gestionar clientes, ubicaciones, tareas, fichajes,
presupuestos y facturas básicas a gestionar una empresa de servicios completa:
ventas, contratos, equipos, trabajadores, calidad, material, costes, cobros y
rentabilidad.

Para el sector limpieza habrá una sola aplicación: WorkHive Cleaning. Una
empresa pequeña y una grande usarán el mismo producto; los planes decidirán
cuántas personas pueden usarlo y qué partes se activan.

Esta no es la única aplicación que existirá en el futuro. WorkHive Core será
la base común sobre la que podrán construirse aplicaciones específicas, como
WorkHive Jardinería, WorkHive Fontanería y WorkHive Electricidad. Core guardará
lo que todos los sectores comparten: empresas, usuarios, permisos, planes,
clientes, contactos, ubicaciones, presupuestos, contratos, trabajos, tiempo,
documentos, avisos y facturación.

Cada aplicación añadirá solo lo propio de su oficio. Cleaning tendrá espacios,
superficies, tareas de limpieza, productos y controles de calidad; Jardinería
podrá tener zonas verdes, especies, riego y estacionalidad; Fontanería o
Electricidad tendrán instalaciones, averías, partes técnicos y certificaciones.

Prepararemos WorkHive Core desde el primer día mientras desarrollamos WorkHive
Cleaning. La regla será sencilla: si una función sirve igual para cualquier
empresa de servicios, pertenece a Core; si solo tiene sentido para limpieza,
pertenece a Cleaning.

Pero la prioridad es WorkHive Cleaning, nuestro primer producto. No
desarrollaremos funciones genéricas de Core que Cleaning todavía no necesite:
Core crecerá al mismo ritmo que el producto real, con casos de uso, pruebas y
ventas detrás.

Cuando Cleaning funcione, tenga clientes y queramos lanzar una segunda
aplicación, elegiremos la forma de reutilizar Core. Lo correcto será partir de
una versión común de Core, no mantener copias distintas que luego haya que
arreglar una por una. En ese momento decidiremos si vive en un repositorio
compartido o en otra estructura, sin tener que rehacer la lógica ya probada.

## 2. Cómo funciona WorkHive hoy

Hoy WorkHive ya permite a una empresa:

- Crear usuarios y asignarles un rol básico.
- Crear clientes con sus datos principales.
- Crear ubicaciones de un cliente, con zonas, instrucciones, accesos y algunas
  plantillas de tareas.
- Crear trabajos, asignarlos a personas, completarlos mediante listas de
  tareas y guardar evidencias.
- Iniciar y terminar un fichaje ligado a un trabajo o una ubicación.
- Crear presupuestos, facturas, gastos y algunos avisos.
- Guardar un registro básico de actividad, privacidad, invitaciones y
  calendario.

Esto es una buena base, pero las piezas todavía funcionan de forma bastante
separada. Por ejemplo, no existe todavía el contrato que une lo vendido con lo
que se hace; tampoco se puede medir el coste real completo de un servicio.

## 3. Lo que WorkHive todavía no tiene

Estas son las partes que necesitamos crear o completar para competir con un
software Enterprise:

- Empresas con varias sociedades, filiales, delegaciones y centros propios.
- Departamentos y equipos reales, con responsables y miembros.
- Permisos detallados: qué puede ver y hacer cada persona, y sobre qué datos.
- Prospectos, oportunidades comerciales, contactos y seguimiento de ventas.
- Catálogo de servicios reutilizable, precios protegidos y presupuestos con
  versiones.
- Contratos con servicios, ubicaciones, horarios, SLA, renovaciones y
  facturación acordada.
- Planificación de equipos, turnos, disponibilidad, recurrencias, conflictos y
  reasignaciones.
- Fichaje completo: pausas, horas previstas y reales, cambios justificados,
  aprobaciones y coste laboral.
- Control de calidad, inspecciones, incidencias, reclamaciones y mejoras.
- Proveedores, compras, almacenes, stock, material asignado a equipos y
  activos como vehículos, máquinas y herramientas.
- Cobros, pagos, reparto de gastos y margen real.
- Portal del cliente, informes, integraciones y automatizaciones seguras.

Por tanto, sí: vamos a mejorar y ampliar gran parte de la base de datos y del
backend. Lo haremos paso a paso y manteniendo los datos actuales.

## 4. Qué aprovechamos de la propuesta compartida

La propuesta de tu compañera encaja con nuestro plan y mejora la visión general.
Incorporamos estas ideas:

- Separar Organización, Clientes, Comercial, Operaciones, RRHH y Finanzas.
- Usar el viaje: lead o prospecto → oportunidad → presupuesto → contrato →
  planificación → trabajo → horas y costes → factura → cobro → rentabilidad.
- Dar a cada cliente una vista completa de sus contactos, ubicaciones,
  contratos, trabajos, facturas, documentos e incidencias.
- Añadir compras, inventario, activos, calidad, informes, portal del cliente e
  integraciones.
- Construir el producto pensando desde ahora en empresas grandes.

La imagen compartida explica bien el viaje principal. Hay dos matices
importantes: RRHH y disponibilidad alimentan la planificación antes de crear
trabajos; y la calidad o las incidencias vuelven a Operaciones para corregir y
mejorar el servicio.

## 5. Correcciones importantes para no construir mal

### No habrá muchos roles globales

No crearemos un rol global distinto para Comercial, RRHH, Calidad, Finanzas,
Supervisor, etc. Eso haría la aplicación rígida y difícil de mantener.

Cada empresa tendrá tres clases internas sencillas: administrador, responsable
o trabajador. Sirven para organizar usuarios y aplicar los límites de cada
plan. Dirección, Comercial, RRHH, Calidad, Finanzas y Operaciones no serán
roles globales: serán perfiles de acceso que la empresa asigna a sus personas.

Habrá además un superadministrador de plataforma, pero es solo para el equipo
de WorkHive. Puede administrar el producto completo y las empresas clientes;
no cuenta como usuario de una empresa ni aparece en su equipo. Tendrá acceso
reforzado y toda acción quedará registrada.

El administrador de una empresa no es un superadministrador de plataforma.
Gestiona solo su propia empresa: invita y desactiva usuarios, configura la
empresa, asigna perfiles y límites permitidos, y administra las integraciones
autorizadas. No puede ver ni modificar otra empresa de WorkHive.

Un cliente tampoco será un trabajador ni un usuario interno. El cliente tendrá
contactos; cada contacto invitado al portal tendrá acceso solamente a los datos
de su propia empresa. Ese acceso no contará como plaza contratada.

Un administrador de propiedades, una inmobiliaria o cualquier empresa que solicita
servicios será igual que un contacto de cliente o partner. No tendrá rol
interno, plaza contratada, empresa propia en WorkHive ni dashboard operativo.
Tendrá un Portal de Partner limitado a las ubicaciones que gestione: podrá
enviar solicitudes o reservas y seguir sus trabajos, incidencias y documentos
autorizados.

El gestor contable o asesoría es otro concepto distinto de una inmobiliaria.
Tendrá un Portal de Gestoría: es un acceso externo, no un rol interno ni una
plaza de administrador, responsable o trabajador. Usará la misma base segura
de invitación y acceso externo que un portal de partner, pero tendrá su propio
panel y permisos financieros.

El gestor solo podrá consultar y exportar, para las empresas que le autoricen,
facturas, gastos, libro de ventas, resumen fiscal y documentos financieros
compartidos. No podrá modificar finanzas ni ver trabajos, equipos, fichajes,
calendario, configuración, suscripción ni información de otra empresa.

El rol actual accountant se migrará gradualmente a este Portal de Gestoría.
Así un mismo gestor podrá trabajar para varias empresas sin convertirse en
usuario interno de ninguna: cada empresa le concederá, limitará o revocará su
acceso de forma independiente y quedará registro de cada acción.

Cada perfil dirá qué puede ver y hacer una persona. También dirá hasta dónde
llega su acceso: sus propios datos, su equipo, su departamento, sus
ubicaciones o toda la empresa.

Ejemplos:

- Un comercial puede crear prospectos, contactos y oportunidades, pero no ver
  precios, facturas, costes ni rentabilidad.
- Un trabajador solo ve sus trabajos, sus horarios, instrucciones y fichajes.
  No verá el directorio completo de clientes.
- Un responsable verá solo sus equipos y ubicaciones asignadas, no toda la
  empresa por defecto.
- Calidad puede inspeccionar una ubicación asignada sin ver datos financieros.
- Finanzas puede trabajar facturas, cobros y margen sin modificar la
  planificación diaria.

Una persona puede tener más de un perfil y cada uno puede tener un alcance
distinto. Por ejemplo, Laura puede ser responsable, tener el perfil de
Operaciones para gestionar trabajos de Girona y el perfil de Calidad para
inspeccionar las ubicaciones que le asignen.

La aplicación ocultará lo que no corresponde, pero el backend también lo
bloqueará: conocer una dirección web no dará acceso.

### No todo es un único árbol

Grupo empresarial, sociedad, delegación, departamento, equipo y ubicación no
significan lo mismo.

- Grupo empresarial: conjunto de sociedades de un mismo cliente de WorkHive.
- Sociedad: empresa legal que factura, contrata o emplea.
- Delegación o centro propio: lugar o zona desde donde opera la empresa.
- Departamento: área de trabajo, como Comercial, RRHH o Finanzas.
- Equipo: grupo operativo de personas, temporal o permanente.
- Ubicación: centro del cliente donde se presta el servicio.

Estas piezas estarán conectadas, pero no se mezclarán. Así una persona puede
trabajar en un equipo de Operaciones, depender de un departamento y cubrir
varias ubicaciones sin que se pierda el sentido de cada dato.

### No duplicaremos clientes y prospectos

Un prospecto puede convertirse en cliente. No queremos copiar sus contactos,
historial ni ubicaciones al ganar una oportunidad.

Habrá una única ficha de empresa o cuenta comercial. Al principio puede ser
prospecto; cuando acepta una relación comercial, pasa a ser cliente. Los
contactos vivirán en fichas propias y podrán tener funciones distintas:
comercial, facturación, responsable de ubicación, emergencia o calidad.

### Trabajo, factura y cobro son cosas diferentes

Un contrato dice qué se ha vendido. Un trabajo dice qué se hizo un día
concreto. Una factura dice qué se cobra. Un cobro dice qué dinero se ha
recibido.

Por eso un trabajo terminado no tiene por qué estar cobrado ni siquiera
facturado todavía. También se podrá facturar parte de un contrato o varias
órdenes juntas sin cambiar el estado real del trabajo.

### La rentabilidad se calcula, no se rellena a mano

La rentabilidad será el resultado de unir ingresos y costes reales:

- Horas aprobadas de trabajadores.
- Material consumido.
- Gastos y compras.
- Vehículos, maquinaria o desplazamientos cuando corresponda.
- Subcontratas.
- Facturas emitidas y cobros recibidos.

Así podremos comparar lo previsto en el presupuesto con lo que realmente ha
costado el contrato, la ubicación, el servicio o el trabajo.

## 6. La nueva forma de trabajar en WorkHive

Este será el viaje completo para una empresa de servicios:

1. La empresa configura sus sociedades, delegaciones, departamentos, equipos,
   usuarios y permisos.
2. Comercial registra un prospecto, sus contactos y una oportunidad.
3. Se eligen servicios de una biblioteca común y se crea un presupuesto.
4. El presupuesto aprobado se convierte en contrato, con sus precios,
   ubicaciones, servicios, horarios, condiciones y renovaciones.
5. Operaciones prepara cada ubicación: zonas, accesos, documentos, riesgos,
   responsables y equipo asignado.
6. El contrato crea trabajos periódicos o puntuales. Cada trabajo tiene
   duración prevista, personas/equipo, instrucciones y lista de tareas.
7. Los trabajadores ven sus tareas, fichan, registran pausas y aportan
   evidencia.
8. Un responsable revisa horas, calidad e incidencias. Si hay un problema,
   crea una acción para corregirlo y comprobar su cierre.
9. Se registra el material, los gastos, las compras y los recursos usados.
10. Finanzas factura según el contrato, registra cobros y calcula el margen.
11. Dirección consulta datos claros por empresa, delegación, cliente, contrato,
    ubicación, servicio, equipo y trabajador.

## 7. Qué cambiaremos en cada parte de la aplicación

### Organización, usuarios y seguridad

Vamos a añadir:

- Grupo empresarial y sociedades cuando una empresa grande lo necesite.
- Delegaciones, centros propios, departamentos y equipos.
- Pertenencia de cada persona a la empresa, al departamento y al equipo.
- Perfiles de permiso y límites de acceso.
- Registro claro de quién cambió un permiso, un precio, un contrato o un
  fichaje.
- Más adelante: acceso reforzado para grandes empresas, como doble factor o
  acceso corporativo.

El usuario seguirá existiendo como cuenta personal. Lo que cambia es que su
puesto, permisos, equipos y relación laboral no estarán mezclados en un único
campo.

### Planes de suscripción

Habrá cuatro planes: Pequeñas empresas, Medianas, Grandes y Extra grandes,
además de un plan a medida.

- Las plazas internas de administrador, responsable y trabajador cuentan para
  la suscripción. Los contactos de portal, partners, inmobiliarias y
  administradores de propiedades no ocupan esas plazas, pero cada plan tendrá límites propios
  para evitar un acceso externo ilimitado y gratuito.
- Los gestores contables tampoco ocupan plazas internas, pero cada plan tendrá
  un límite de accesos de gestoría. Así su uso profesional está controlado y
  no se convierte en un dashboard completo gratuito.
- El plan Pequeñas empresas parte de 1 administrador, 2 responsables y 5
  trabajadores.
- El plan Grandes empresas tendrá como referencia 10 administradores, 20
  responsables y 100 trabajadores.
- Los límites exactos de Medianas y Extra grandes se decidirán antes de
  programarlos.
- La prueba gratuita usará todas las capacidades de Extra grandes.
- El plan a medida permitirá activar o bloquear módulos y ajustar límites para
  una empresa concreta.
- Los límites se comprobarán realmente antes de crear usuarios o usar una
  función. No será solo un botón oculto.

Los departamentos, perfiles personalizados, calidad avanzada, inventario, RRHH
e integraciones se activarán según el plan que se apruebe.

### Clientes y Comercial

Vamos a mejorar Clientes con:

- Prospectos, clientes y contactos múltiples.
- Personas responsables de comercial, facturación, calidad y cada ubicación.
- Cartera de clientes por comercial.
- Oportunidades, llamadas, visitas, notas y seguimiento.
- Etiquetas y datos propios de cada empresa.
- Historial comercial completo.

Comercial gestionará prospectos, contactos y oportunidades, pero no verá
precios, costes, facturas ni margen. Administración o Finanzas preparará y
aprobará la parte económica del presupuesto.

### Biblioteca de servicios, presupuestos y contratos

Vamos a crear una biblioteca única de servicios para no repetir tareas en
cada ubicación.

Cada servicio podrá tener:

- Categoría, instrucciones, duración prevista, personas necesarias y lista de
  tareas.
- Material, requisitos, riesgos y criterios de calidad.
- Precio, coste previsto y versiones para conservar el histórico.

Los presupuestos tendrán revisiones y aprobaciones. Cuando un presupuesto se
acepte, se creará un contrato. El contrato guardará qué servicios se prestan,
en qué ubicaciones, cada cuánto, bajo qué condiciones, con qué SLA y hasta qué
fecha.

### Servicios, espacios y tareas no son lo mismo

La Biblioteca de Servicios no sustituye espacios ni tareas. Los tres niveles
trabajarán juntos:

- Servicio: lo que vendemos, por ejemplo limpieza recurrente o limpieza de
  cristales. La forma de gestionar servicios será parte de WorkHive Core; los
  servicios de limpieza concretos pertenecen a WorkHive Cleaning.
- Espacio: dónde se realiza el trabajo, por ejemplo Baño 1, Recepción o Sala de
  reuniones. Los espacios, superficies y tipos de espacio son propios de
  Cleaning.
- Tarea: la acción concreta, por ejemplo limpiar WC, aspirar o reponer jabón.
  WorkHive Core permite asignar pasos a un trabajo; la biblioteca de tareas de
  limpieza y sus plantillas pertenece a Cleaning.

Al añadir un espacio Baño a una ubicación, Cleaning propondrá las tareas
habituales de baño. La empresa podrá conservarlas, eliminarlas, modificarlas o
añadir tareas propias. Una vez se genera un trabajo, quedará guardada la lista
de tareas de ese día para que un cambio posterior de plantilla no altere el
histórico.

### Ubicaciones

Las ubicaciones se rediseñarán usando componentes shadcn/ui y las capturas
compartidas como referencia visual.

Cada ubicación tendrá de forma ordenada:

- Cliente, dirección, coordenadas y horario.
- Contactos y responsables.
- Zonas, espacios, superficies y características propias del sector limpieza.
- Accesos, llaves e instrucciones protegidas.
- Riesgos, documentos, planos y certificados.
- Servicios contratados, ventanas para realizar el servicio y SLA.
- Equipo responsable, sustituciones y material relacionado.
- Historial de trabajos, fichajes, calidad, incidencias y costes.

La información de acceso sensible solo llegará a quien la necesite para un
trabajo asignado.

### Trabajos, planificación y fichajes

Los trabajos actuales se convertirán gradualmente en órdenes de trabajo más
completas, sin borrar de golpe lo que ya existe.

Cada orden podrá incluir:

- Contrato, cliente, ubicación, servicio y fecha.
- Prioridad, estado, responsable, equipo y trabajadores.
- Duración y personas previstas.
- Pasos, tareas, zonas, fotos y evidencias.
- Material previsto y material consumido.
- Calidad, incidencia y seguimiento.

La planificación tendrá calendario, recurrencias, turnos, disponibilidad,
conflictos y reasignaciones.

El fichaje incluirá entrada, salida, pausas, ubicación de inicio y fin cuando
corresponda, horas previstas, horas reales, horas extra, cambios con motivo y
aprobación. Una corrección no borrará el dato original: quedará registrada.

### Personal, equipos y RRHH

Cada trabajador tendrá una ficha relacionada con su cuenta de acceso, pero
separada de ella. Incluirá equipo, departamento, responsable, coste por hora,
estado, documentos, formación, certificaciones y competencias.

Después se añadirá la parte más sensible de RRHH: contratos laborales,
vacaciones, ausencias, permisos y bajas. Se hará con especial cuidado por la
privacidad y las reglas laborales.

Los equipos podrán ser permanentes o temporales. Tendrán responsable,
miembros, zona o delegación, disponibilidad, ubicaciones cubiertas y material
asignado.

### Calidad, incidencias y mejora

Vamos a completar el control de calidad con:

- Plantillas de inspección por servicio o ubicación.
- Puntuación, fotos, evidencia y firma.
- Inspecciones planificadas o sorpresa.
- Incidencias y reclamaciones con prioridad, responsable y SLA.
- Acciones correctivas, fecha límite, comprobación y cierre.
- Informes de calidad por ubicación, contrato, equipo y trabajador.

Una incidencia no desaparecerá al cerrar un trabajo: se seguirá hasta que se
compruebe que la mejora funciona.

### Material, compras, inventario y activos

Se añadirán:

- Proveedores, contactos, condiciones, precios y evaluación.
- Solicitudes de compra, aprobaciones, pedidos, recepción y factura de
  proveedor.
- Productos, categorías, código interno, coste, stock y almacenes.
- Entradas, salidas, transferencias, consumo y ajustes.
- Material asignado a cada equipo y consumo ligado a trabajos.
- Vehículos, máquinas, herramientas y equipamiento con responsable, estado,
  valor, historial y mantenimiento.

El material consumible y un activo como una máquina no se tratarán igual: uno
se gasta; el otro se mantiene y tiene historial.

### Finanzas, cobros y rentabilidad

Se conservará la facturación que ya existe y se ampliará con:

- Facturación recurrente desde contratos.
- Facturas rectificativas e histórico protegido.
- Cobros parciales y reparto de un cobro entre varias facturas.
- Gastos conectados a proveedor, contrato, ubicación, equipo o trabajo.
- Reparto de un gasto cuando afecte a varios servicios.
- Costes de personal, material, compra, subcontrata y recursos.
- Comparación entre margen previsto y margen real.

Finanzas y Dirección podrán analizar resultados por sociedad, delegación,
cliente, contrato, ubicación, servicio, equipo o trabajo. Cada perfil verá
solo lo permitido.

### Documentos, avisos, informes e integraciones

Habrá una parte común para:

- Documentos de clientes, trabajadores, proveedores, contratos y ubicaciones.
- Versiones, firmas, caducidades y permisos de documento.
- Comentarios, menciones, avisos, recordatorios e historial.
- Aprobaciones de presupuestos, gastos, descuentos, contratos y horas extra.
- Informes en PDF, Excel y CSV, con filtros de acceso.
- Búsqueda global que solo muestre resultados permitidos.
- Importaciones masivas con validación antes de guardar.
- Portal del cliente para consultar sus propios datos.
- Integraciones y API para contabilidad, nóminas, bancos, correo, calendario,
  BI y firma digital.
- Automatizaciones seguras, por ejemplo avisar de un contrato próximo a vencer
  o de una factura vencida.

No construiremos un sistema genérico gigantesco de aprobaciones o
automatizaciones al principio. Empezaremos con los casos reales más
importantes: presupuesto, corrección de horas y gastos.

## 8. Orden de trabajo

No se hará todo en una única entrega. Este es el orden que evita rehacer la
aplicación varias veces.

### Fase 0 — Acordar antes de programar

- Aprobar este documento y las decisiones pendientes.
- Definir nombres, estados, permisos y límites de cada parte.
- Preparar una empresa de prueba que represente una empresa grande.
- Revisar qué datos actuales se deben conservar.
- Marcar cada parte como base común de Core o como función propia de Cleaning,
  sin retrasar el primer producto por una aplicación futura.
- Diseñar pruebas antes de cambiar una función.

Resultado: sabemos qué vamos a crear y cómo comprobar que funciona.

### Fase 1 — Base para empresas grandes

- Usuarios, puestos, departamentos, equipos y permisos.
- Planes, límites y funciones activas.
- Protección real de la información en backend.
- Cambio gradual de los roles actuales.

Resultado: una empresa puede tener Comercial, Operaciones, Calidad, RRHH y
Finanzas sin que cada área vea información ajena.

### Fase 2 — Clientes y ventas

- Prospectos, clientes, contactos, oportunidades y actividad comercial.
- Cartera de cada comercial.
- Migración cuidadosa de los clientes actuales.

Resultado: Comercial puede captar y seguir clientes sin ver información
financiera protegida.

### Fase 3 — Servicios, presupuestos y contratos

- Biblioteca común de servicios.
- Presupuestos con versiones, aprobaciones y precios protegidos.
- Contratos, SLA, renovaciones, ubicaciones y servicios contratados.

Resultado: cada venta se convierte en un acuerdo claro que Operaciones puede
ejecutar.

### Fase 4 — Ubicaciones

- Rediseño completo de ubicaciones.
- Zonas, responsables, horarios, documentos, riesgos, accesos, equipos y
  servicios contratados.

Resultado: el responsable dispone de toda la información para organizar el
servicio en cada centro.

### Fase 5 — Trabajos, planificación y tiempo

- Órdenes de trabajo, recurrencias, calendario y asignaciones.
- Equipos, trabajadores, duración prevista y real.
- Fichajes, pausas, correcciones, aprobaciones y evidencias.

Resultado: horas y minutos fiables para planificar, pagar y facturar.

### Fase 6 — Calidad e incidencias

- Inspecciones, puntuación, evidencia y firma.
- Incidencias, reclamaciones y acciones correctivas.

Resultado: se puede demostrar la calidad del servicio y mejorarla.

### Fase 7 — Material, compras, gastos y activos

- Proveedores, compras, stock, material de equipos y activos.
- Consumo y gasto relacionados con cada trabajo.

Resultado: cada coste relevante tiene un origen y un destino.

### Fase 8 — Cobros, margen y analítica

- Cobros, repartos, costes y margen previsto frente a real.
- Paneles e informes por el ámbito permitido.

Resultado: Dirección conoce qué clientes, servicios y ubicaciones son
rentables.

### Fase 9 — Portal, automatizaciones e integraciones

- Portal de cliente y partner, incluida inmobiliaria o administrador de propiedades,
  para solicitudes, reservas y seguimiento.
- Portal de Gestoría para asesores financieros externos.
- Aplicación del trabajador ampliada.
- Integraciones priorizadas, API y automatizaciones auditables.

Resultado: WorkHive se conecta con el resto de herramientas de la empresa sin
perder control ni seguridad.

## 9. Cómo trabajaremos en cada fase

Antes de empezar una fase:

- Revisaremos las pantallas, datos, permisos y efectos en el resto de la
  aplicación.
- Acordaremos las decisiones que cambian el producto.
- Prepararemos pruebas para no romper lo que ya funciona.

Durante la fase:

- Separaremos claramente datos, reglas de negocio y pantallas.
- Usaremos el patrón repositorio en backend y frontend.
- Usaremos componentes shadcn/ui. Si no existe un componente adecuado,
  propondremos una alternativa compatible con Tailwind antes de añadirla.
- No haremos cambios grandes no relacionados.

Al terminar:

- Probamos el flujo completo con datos de prueba realistas.
- Ejecutamos pruebas automáticas, revisión de tipos, estilo y compilación.
- Abrimos una PR pequeña, la revisamos y la fusionamos antes de continuar.

## 10. Decisiones que necesitamos cerrar

1. La empresa de WorkHive podrá tener varias sociedades legales cuando lo
   necesite.
2. Departamentos, delegaciones y equipos serán cosas separadas y conectadas.
3. Se mantienen pocas clases de usuario; los perfiles y permisos hacen el
   trabajo diario.
4. Un prospecto se convierte en cliente sin duplicar sus datos.
5. El presupuesto aprobado creará un contrato, no un trabajo directamente.
6. Cada corrección de fichaje tendrá motivo, aprobación e historial.
7. La prueba gratuita tendrá las funciones de Extra grandes.
8. Hay que decidir los límites de los planes Medianas y Extra grandes, y desde
   qué plan se activan departamentos, perfiles, calidad, inventario y RRHH.
9. Comercial no verá precios, costes, facturas ni margen; Administración o
   Finanzas aprobará la parte económica del presupuesto.
10. Cada fase se probará en vivo antes de abrir PR y fusionar.

## 11. Mensaje para el equipo

No estamos haciendo un simple rediseño visual. Estamos convirtiendo WorkHive
en el sistema que conecta venta, contrato, operación, personas, tiempo, coste,
factura y rentabilidad.

El objetivo es tener un producto completo para empresas grandes, sin obligar a
las pequeñas a usar funciones que no necesitan. La forma segura de conseguirlo
es construir primero los permisos y la organización, después la cadena
comercial y operativa, y por último el análisis, el portal y las integraciones.
