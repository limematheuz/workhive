# Guía de aceptación antes del primer cliente

Esta guía se ejecuta en un entorno de pruebas que tenga el mismo correo SMTP y
las mismas reglas de autorización que producción. No se usan datos de un cliente
real ni contraseñas reales en las pruebas.

## 1. Preparación

Crear estas identidades y conservar una tabla de resultados con fecha, operador
y evidencia (ID de la entidad o captura sin datos sensibles):

| Identidad | Uso |
| --- | --- |
| Superadmin WorkHive | Aprueba pruebas, empresas y consultas globales. |
| Admin emisora | Inmobiliaria que encarga un servicio. |
| Admin receptora | Empresa de limpieza que recibe y gestiona el servicio. |
| Dos trabajadores receptora | Prueban asignación individual y a todo el equipo. |
| Cliente de prueba | Destinatario de presupuestos y facturas. |
| Buzón de control | Revisa recepción, asunto, remitente y enlaces de cada email. |

Antes de empezar, confirmar en producción:

- `EMAIL_ENABLED=true`, SMTP funcional y `SMTP_FROM_EMAIL=noreply@workhive.es`.
- `ALLOW_PUBLIC_REGISTRATION=false`: el alta de clientes reales es aprobada por
  WorkHive, no crea cuentas autónomamente.
- La caducidad de una empresa `trialing` se bloquea aunque la facturación Stripe
  permanezca desactivada; no cambies `SUBSCRIPTION_ENFORCEMENT_ENABLED` durante
  esta prueba sin revisar el impacto sobre empresas existentes.
- Copias de seguridad activas y `/health/ready` sano.

Para cada flujo comprobar también lo negativo: cerrar sesión, intentar abrir la
URL como otra empresa y verificar que devuelve acceso denegado o no muestra datos.

## 2. Onboarding de una empresa

1. Como superadmin, crear una empresa de limpieza de prueba con modalidad
   `trial` y un administrador propietario.
2. Iniciar sesión con el administrador desde el enlace de creación de contraseña.
3. Completar el onboarding: modelo operativo, primer local y datos de empresa.
4. Recargar, cerrar sesión y volver a entrar.

**Debe ocurrir:** se crea solo la empresa y el usuario aprobados; el onboarding
no vuelve a aparecer al terminar; el local pertenece únicamente a esa empresa;
el panel global refleja plan, estado y fecha de fin de prueba.

## 3. Clientes, ubicaciones y plantillas

1. Crear un cliente con email, NIF y dirección fiscal.
2. Crear una ubicación asociada, tipo adecuado y dirección completa.
3. Crear una tarea fija de limpieza con varios requisitos/checklist.
4. Editar cliente, ubicación y plantilla; cancelar una edición sin guardar.

**Debe ocurrir:** los cambios se conservan solo al guardar; cancelar no altera
datos; otra empresa no puede listar, modificar ni adivinar los IDs; una ubicación
puede generar tareas sin reservar huéspedes cuando no es una inmobiliaria.

## 4. Presupuesto → aceptación → factura

1. Crear presupuesto para el cliente con una o más líneas, IVA, notas y validez.
2. Abrirlo desde el listado, editarlo y comprobar que se abre el mismo detalle.
3. Enviar el presupuesto a un email del cliente y añadir un CC de prueba.
4. Marcarlo enviado y, si procede, aceptarlo.
5. Crear factura desde trabajos completados o desde líneas manuales.
6. Enviar factura y descargar/ver el PDF.

**Emails a comprobar:** remitente profesional, logo WorkHive, asunto claro,
destinatarios correctos, PDF adjunto cuando corresponde, enlace de soporte y
versión móvil legible.

**Seguridad:** los destinatarios guardados de facturas/presupuestos deben ser
exclusivos de la empresa activa. Abrir el formulario desde la otra empresa no
puede mostrar ni reutilizar sus contactos.

## 5. Trabajo interno: crear, asignar, ejecutar y facturar

1. Como admin receptora, crear una tarea para el local sin contexto de reservas.
2. Verificar que nace en **Pendientes** y no en progreso.
3. Abrir la tarjeta y editarla; debe ser interactiva para un admin.
4. Asignar un requisito a trabajador A, otro a trabajador B y otro a todo el
   equipo. Asignar también el trabajo principal cuando aplique.
5. Con cada trabajador, abrir solo las tareas/requisitos propios, iniciar trabajo,
   registrar tiempo, responder requisitos, adjuntar foto y nota.
6. Intentar completar con un requisito obligatorio pendiente; después completarlo.
7. Marcar la tarea completada y facturarla.

**Debe ocurrir:** no se permite finalizar antes del checklist; cada trabajador
ve únicamente su alcance; un admin conserva la capacidad de editar; el tiempo,
evidencias y progreso son coherentes; la factura solo usa trabajos de su cliente
y empresa.

En móvil verificar que el botón **Empezar tarea** permanece fijo sobre el borde
inferior y que todas las pantallas hacen scroll con un solo gesto.

## 6. Trabajo entre empresa emisora y receptora

1. Crear/autorizar la colaboración entre inmobiliaria emisora y limpieza
   receptora.
2. Desde la emisora, crear una tarea para una ubicación compartida y elegir la
   receptora.
3. Entrar como receptora y revisar la solicitud.
4. Aceptarla, asignar trabajadores, ejecutar checklist y completar trabajo.
5. Volver a la emisora y confirmar que puede seguir el estado, pero no ve datos
   internos innecesarios de trabajadores, costes o contactos privados.

**Estado esperado:** un trabajo remitido por la emisora llega como
**pendiente de aceptar / solicitada**, nunca aceptado automáticamente. Solo pasa
a operativo tras la aceptación explícita de la receptora.

## 7. Reservas

1. Usar este flujo solo con una empresa emisora/inmobiliaria y una ubicación de
   alquiler.
2. Crear salida y próxima entrada; generar el trabajo de cambio asociado.
3. Como receptora, comprobar el contexto visible y completar el servicio.
4. Como una empresa sin colaboración, intentar consultar la reserva y la tarea.

**Debe ocurrir:** el contexto de reservas no aparece como requisito redundante en
una limpieza interna; la receptora solo recibe la información operativa permitida;
la empresa ajena no obtiene información de huéspedes ni reservas.

## 8. Equipo, invitaciones y recuperación de acceso

1. Invitar a un trabajador con rol adecuado y email de prueba.
2. Abrir el email, comprobar empresa, rol, código y caducidad; aceptar el enlace,
   introducir código y crear contraseña.
3. Intentar usar el mismo enlace/código de nuevo y probar varios códigos erróneos.
4. Iniciar sesión y confirmar que el usuario nuevo solo puede acceder a su empresa
   y a las tareas asignadas.
5. Probar restablecimiento de contraseña y cambio de email.

**Debe ocurrir:** una invitación no crea usuario hasta ser aceptada; no se puede
aceptar dos veces, reutilizarla tras caducar ni superar el límite de intentos;
los emails de acceso nunca incluyen contraseñas.

## 9. Solicitud y ciclo de prueba gratuita

1. Desde el formulario público, solicitar una prueba con un email nuevo.
2. Abrir el email de verificación y confirmar el enlace dentro de 24 horas.
3. Como superadmin, aprobar la solicitud con duración conocida (usar 4 días en
   pruebas para observar el aviso de tres días).
4. Abrir el email de aprobación, crear contraseña e iniciar sesión.
5. Comprobar en la cuenta fecha/hora de fin y límite de usuarios del plan.
6. Un día después de la aprobación de una prueba de cuatro días, verificar los
   avisos de “quedan 3 días” al administrador de la empresa y al superadmin.
7. Ajustar únicamente en entorno de prueba la fecha de fin al pasado; volver a
   iniciar sesión y llamar a una acción protegida.

**Debe ocurrir:** la solicitud no crea empresa ni usuario antes de verificación y
aprobación; el usuario recibe enlace para definir contraseña; la prueba expirada
recibe `subscription.trial_expired` y no puede operar; el aviso de tres días se
envía una sola vez por empresa y no revela datos de otra empresa.

## 10. Gastos y beneficio

1. Registrar gastos de categorías distintas, con y sin IVA, en fechas del período.
2. Crear y cobrar una factura de prueba del mismo período.
3. Revisar Finanzas/Analytics con filtros de semana, mes y período personalizado.
4. Editar o anular un gasto y comprobar que los totales se recalculan.

**Debe ocurrir:** ingresos solo incluyen facturas válidas/cobradas conforme a la
vista; gastos, IVA y beneficio cuadran con los documentos; otra empresa no puede
leer los datos financieros.

## 11. Registro de emails profesionales

Para cada email anterior, anotar:

- evento que lo disparó y hora;
- remitente (`noreply@workhive.es`) y Reply-To cuando aplique;
- destinatario, CC y aislamiento entre empresas;
- asunto y versión móvil;
- enlace HTTPS, caducidad y uso único cuando sea de seguridad;
- ausencia de contraseña, token en texto visible o datos de otro tenant.

La plantilla visual debe ser la común de WorkHive: logo, tarjeta clara, tipografía
legible, botón azul, pie con soporte y versión de texto plano equivalente.

## 12. Criterio de salida

No se da acceso al primer cliente hasta que todos los casos estén marcados como
correctos, los fallos tengan ticket/decisión, los emails hayan llegado al buzón de
control y la prueba caducada haya bloqueado realmente una acción autenticada.
