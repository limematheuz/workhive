# Migración de WorkHive a una cuenta AWS nueva

Este runbook prepara una migración reproducible de la infraestructura, no un
traslado improvisado de una máquina. No almacena IDs, dominios, buckets,
contraseñas, certificados ni datos de clientes.

## Principios

- La nueva cuenta se construye desde plantillas y configuración privada nueva.
- EC2 se reprovisiona; no se considera transferible entre cuentas.
- La base PostgreSQL y los archivos persistentes se restauran desde un backup
  validado en un entorno aislado antes del corte.
- El DNS cambia sólo después de verificar salud, login, trabajo asíncrono y
  restauración en la cuenta destino.
- La cuenta original permanece intacta hasta completar el periodo de
  observación y rollback acordado.

AWS recomienda reprovisionar recursos con IaC y mantener los workloads lo más
sin estado posible. Para recursos no transferibles directamente entre cuentas,
la migración se hace creando recursos nuevos y moviendo datos de forma
controlada. Consulta la documentación oficial enlazada desde la guía de
producción antes del corte.

## Antes del corte

1. Inventariar la cuenta origen: EC2/EBS, VPC y security groups, IAM, SSM,
   ECR, S3 de backups, DNS/certificados, secretos y proveedores externos.
2. Registrar el último tag de release saludable y validar un backup completo
   de PostgreSQL y `/data` en una restauración aislada.
3. Crear la cuenta destino, habilitar MFA, presupuesto, alertas de coste y
   CloudTrail antes de crear cargas de trabajo.
4. Desplegar la plantilla
   [`workhive-host-observability.yaml`](../../ops/monitoring/workhive-host-observability.yaml)
   mediante un change set. El correo de alertas se confirma fuera de Git.
5. Crear roles separados: EC2 (ECR pull, backup write y métrica host),
   publicación GitHub OIDC y despliegue GitHub OIDC/SSM. No reutilizar claves
   estáticas ni permisos de administrador.
6. Crear repositorios ECR y activar tags inmutables. Publicar una release
   revisada en la cuenta destino antes del corte.
7. Crear el documento SSM `WorkHiveProductionDeploy` desde su YAML canónico y
   establecer su versión revisada como predeterminada.
8. Instalar el agente CloudWatch con la configuración versionada
   [`amazon-cloudwatch-agent.json`](../../ops/monitoring/amazon-cloudwatch-agent.json)
   y verificar la alarma de disco mediante una métrica real.

## Datos y corte

1. Programar una ventana y pausar escrituras externas.
2. Ejecutar un backup final verificable en la cuenta origen.
3. Restaurar PostgreSQL y `/data` en la cuenta destino; ejecutar las
   migraciones únicamente hacia delante con la release elegida.
4. Validar `/health`, inicio de sesión, una operación de lectura y una
   escritura no destructiva en la cuenta destino.
5. Cambiar DNS con un TTL reducido previamente y vigilar errores, disco,
   backups y costes durante el periodo acordado.
6. Conservar origen, backups y la release anterior hasta aprobar el cierre.

## Después del corte

- Rotar secretos y credenciales de terceros que hayan cambiado de entorno.
- Cambiar las variables protegidas de GitHub al ARN OIDC, región e instancia
  de la cuenta destino; nunca guardes claves AWS estáticas.
- Verificar que el despliegue, el backup semanal, el mantenimiento Docker y la
  alarma de disco funcionan en destino.
- Eliminar recursos de origen sólo tras una decisión explícita y una
  restauración comprobada.
