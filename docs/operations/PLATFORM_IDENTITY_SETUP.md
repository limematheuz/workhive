# Equipo de plataforma

En una base nueva, un operador con acceso al backend ejecuta
`python -m scripts.create_superadmin --email persona@empresa.es --name "Nombre completo"`
dentro del contenedor, en una terminal interactiva. La contraseña se introduce
en privado. La primera alta cierra la inicialización en esa base de datos.

Cada técnico entra por el login habitual de WorkHive. Un superadmin puede abrir
**Equipo de plataforma** en el menú del dashboard para invitar o revocar técnicos.
Utiliza una dirección dedicada para cada técnico. El enlace permite elegir
una contraseña durante 24 horas. En producción el enlace se entrega por correo. En desarrollo, si el correo falla, el superadmin recibe
el enlace en pantalla para entregarlo por un canal privado al destinatario.

En **Equipo de plataforma**, una invitación pendiente se puede reenviar o cancelar.
Revocar a un técnico activo invalida sus sesiones. **Volver a invitar** conserva
su cuenta y su historial. Recupera el acceso al aceptar el nuevo enlace y
establecer la contraseña. Si el enlace caduca, usa **Reenviar invitación**.

Al migrar desde Keycloak, los miembros activos conservan su identidad en WorkHive.
Deben establecer la contraseña desde «Olvidé mi contraseña» si antes solo usaban
la contraseña externa. Configura el SMTP de WorkHive y FRONTEND_URL con el origen
HTTPS del despliegue. Las invitaciones externas pendientes se deben emitir de nuevo.

## Comprobación pendiente para el primer despliegue

El flujo de invitación, revocación y reactivación está validado en local.
Queda pendiente comprobar la integración con el dominio, TLS y el correo reales.

- [ ] Confirmar que el dominio definitivo sirve WorkHive por HTTPS con un certificado válido.
- [ ] Enviar una invitación desde Equipo de plataforma a un buzón de prueba autorizado y confirmar su recepción.
- [ ] Abrir el enlace desde otro dispositivo, comprobar que apunta al dominio definitivo, activar la cuenta e iniciar sesión.
- [ ] Revocar el acceso de la cuenta de prueba y comprobar que su sesión pierde acceso al equipo.
