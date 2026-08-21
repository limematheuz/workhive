# Google Calendar en WorkHive

## Decisión de producto

Google Calendar es una integración **opcional**. WorkHive sigue siendo el calendario operativo compartido para toda la empresa, incluso si nadie conecta Google. No se requiere una cuenta Gmail ni Google Workspace para usar WorkHive.

Cada empresa conecta un único calendario Google de empresa. El administrador principal autoriza esa conexión; el calendario y las tareas de WorkHive siguen estando disponibles para los administradores y managers autorizados de esa empresa.

Esta decisión evita que varias cuentas personales creen calendarios duplicados o sin una fuente clara de verdad.

## Qué necesita la persona que conecta

Google solo permite dar acceso a un calendario Google a una identidad de Google. Puede ser cualquiera de estas opciones:

| Correo de la persona | ¿Puede conectar Google Calendar? | Coste adicional para WorkHive |
| --- | --- | --- |
| `persona@gmail.com` | Sí | No |
| `persona@empresa.com` ya registrado como Cuenta de Google | Sí | No |
| `persona@empresa.com` en Google Workspace | Sí, salvo política interna de su empresa | No |
| Correo corporativo sin Cuenta de Google | No hasta que el titular cree una Cuenta de Google con ese mismo correo | No |

Una dirección corporativa no necesita terminar en `@gmail.com`. Google permite crear una Cuenta de Google usando un correo existente de empresa. Google Workspace tampoco es un requisito de WorkHive: solo es la opción de empresas que ya administran sus usuarios con Google.

Al pulsar **Conectar Google Calendar**, Google muestra el selector de cuentas. La Cuenta de Google elegida puede ser distinta del correo con el que el administrador inició sesión en WorkHive. Nadie puede autorizar un calendario Google en nombre de otra persona sin ese consentimiento.

## Flujo para una empresa

1. Un administrador abre **Calendario** en WorkHive.
2. Si es el administrador principal, pulsa **Conectar Google Calendar**.
3. Google muestra o preselecciona su cuenta; el administrador inicia sesión si fuera necesario y acepta los permisos.
4. WorkHive crea o actualiza el calendario `WorkHive - Nombre de empresa` y sincroniza las tareas.
5. El resto de administradores y managers continúa gestionando el calendario compartido desde WorkHive. No necesitan conectar una cuenta Google personal para trabajar en WorkHive.

Para cambiar al administrador que controla la conexión, primero se desconecta el calendario actual y después se aprueba la solicitud de control. Esto evita transferencias silenciosas de credenciales.

## Si una empresa usa Microsoft, Apple u otro proveedor

No se debe obligar a la empresa a crear Gmail ni comprar Google Workspace. WorkHive funciona sin Google. Una futura integración de calendario para esos casos debe ofrecer una suscripción personal ICS de solo lectura, separada de la sincronización bidireccional con Google. No debe reutilizar ni exponer credenciales Google.

## Configuración de plataforma para producción

La plataforma usa un solo cliente OAuth de Google Cloud. Nunca se guardan su secreto ni claves en este repositorio.

Comprueba en Google Cloud, sin copiar secretos a tickets ni documentación:

1. **Google Calendar API** está habilitada en el proyecto correcto.
2. La pantalla de consentimiento tiene una dirección de soporte, política de privacidad y dominios autorizados correctos.
3. La aplicación está publicada para el público previsto; el modo de pruebas solo permite a los usuarios de prueba definidos en Google.
4. La URI de redirección autorizada coincide exactamente con la URL de producción de `/api/v1/calendar/google/callback`.
5. El cliente OAuth usa únicamente los scopes mínimos actuales: `openid`, `email` y `https://www.googleapis.com/auth/calendar`.

Una empresa cliente con Google Workspace puede bloquear aplicaciones OAuth de terceros. En ese caso, su propio administrador de Workspace debe permitir el cliente OAuth de WorkHive y los scopes de Calendar. WorkHive no puede ni debe eludir esa política.

## Diagnóstico seguro

| Resultado visible | Qué significa | Siguiente acción |
| --- | --- | --- |
| La persona cancela en Google | No se concedió autorización | Puede volver a pulsar conectar; WorkHive no se bloquea. |
| Error de configuración | La plataforma debe revisar el cliente OAuth o la URI de redirección | Revisar la lista anterior y logs del servidor sin divulgar tokens. |
| Google bloquea la aplicación por política de empresa | Workspace del cliente restringe OAuth | Pedir a su administrador de Workspace que permita WorkHive. |
| El correo no tiene Cuenta de Google | No existe identidad Google para Calendar | Usar WorkHive sin integración o crear voluntariamente una Cuenta de Google con ese mismo correo. |

Una cuenta de Google Business Profile, una cuenta de servicio o las credenciales de WorkHive no sustituyen la identidad y el consentimiento del usuario. La delegación de dominio solo aplica cuando la propia empresa cliente administra Google Workspace y decide autorizarla explícitamente.
