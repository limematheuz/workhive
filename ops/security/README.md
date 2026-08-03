# Protección de borde con AWS WAF

La producción actual ejecuta Caddy directamente en una EC2. AWS WAF no puede
asociarse a una EC2: requiere un recurso compatible, como un Application Load
Balancer (ALB). Esta carpeta contiene una plantilla de CloudFormation que crea
un Web ACL regional y lo asocia a un ALB público existente.

> **Estado: WIP — despliegue aplazado por coste.** La configuración está
> versionada y validada, pero actualmente no existe un ALB ni un Web ACL
> desplegados para WorkHive. No ejecutes la plantilla, no cambies DNS ni
> security groups, y no actives `EDGE_TLS_TERMINATED` hasta retomar este corte
> de producción con presupuesto aprobado.

La plantilla bloquea las fuentes con mala reputación, reglas administradas para
entradas conocidas y SQL injection, y limita por IP las escrituras públicas,
la API completa y el sitio completo. Las respuestas de límite usan HTTP 429.
El límite de cuerpo del ALB es fijo en 8 KB, así que `SizeRestrictions_BODY` se
deja en modo `Count`; la configuración de Caddy para el ALB conserva un límite
real de 6 MB para la API.

| Regla | Límite inicial |
| --- | --- |
| Formularios y escrituras públicas | 60 solicitudes/IP/minuto |
| API | 1.200 solicitudes/IP/minuto |
| Sitio completo | 5.000 solicitudes/IP/minuto |

No ejecutes esta plantilla ni cambies DNS hasta que el cambio se haya revisado,
fusionado y se haya validado la integración de ALB en un entorno de prueba.

## Corte de producción seguro

1. Crea un ALB público en la misma VPC que la EC2, con dos subredes públicas y
   un certificado ACM para el dominio de la aplicación en su listener HTTPS.
   Activa `routing.http.preserve_host_header.enabled=true`,
   `routing.http.drop_invalid_header_fields.enabled=true`,
   `routing.http.desync_mitigation_mode=strictest` y conserva
   `waf.fail_open.enabled=false`. El primero permite que Caddy valide el host
   público; los demás rechazan cabeceras inválidas, endurecen HTTP desync y
   evitan que el ALB salte el WAF si éste no está disponible.
2. Crea inicialmente un target group `HTTPS:443` hacia Caddy, conserva la
   configuración actual de Caddy y verifica el login a través del DNS del ALB
   enviando el host público. Esto permite preparar el nuevo borde sin abrir
   tráfico HTTP al origen.
3. Aplica la plantilla WAF al ALB, cambia el DNS público al ALB y verifica
   `https://<dominio>/health`, login y un formulario público. No guardes ARN,
   IDs, dominios reales ni certificados en Git.
4. Tras verificar que el tráfico entra por el ALB, deja en el security group
   de la EC2 únicamente el puerto 443 desde el security group del ALB y elimina
   las reglas públicas directas de los puertos 80 y 443. En este punto ya no
   existe un camino que pueda eludir el WAF.
5. Programa una ventana de mantenimiento para convertir el origen a HTTP y
   evitar depender de la renovación de certificados de Caddy. Crea un segundo
   target group `HTTP:80` y permite el puerto 80 de la EC2 sólo desde el ALB.
   Activa `EDGE_TLS_TERMINATED=true` en el archivo privado
   `/etc/workhive/deploy.env`; el siguiente despliegue usará
   `docker-compose.alb.yml`, que sirve `/health` para el health check del ALB
   y preserva `X-Forwarded-Proto: https` hacia la API. Cuando el segundo target
   esté sano, cambia el listener al target HTTP y retira la regla ALB→EC2 del
   puerto 443.
6. Conserva AWS Shield Standard, incluido sin coste con ALB, como protección
   de red. AWS WAF limita solicitudes HTTP, pero no sustituye esa capa.

El paso 4 es una condición de seguridad, no una optimización. Si la EC2 sigue
siendo pública, un atacante puede evitar las reglas del Web ACL.

El paso 5 se ejecuta sólo después de que el origen esté restringido al ALB:
puede producir unos segundos de indisponibilidad mientras el target HTTP pasa
a sano, pero no abre una ruta directa ni debilita HTTPS para los clientes. Si
falla, vuelve el listener al target HTTPS y deja
`EDGE_TLS_TERMINATED=false`.

## Validación y despliegue controlado

Valida la estructura versionada sin acceso a AWS:

```bash
python3 ops/security/test_waf_template.py
python3 ops/security/test_edge_configuration.py
```

Después de revisar la plantilla, y únicamente desde una sesión AWS autorizada,
aplíscala con identificadores privados:

```bash
aws cloudformation deploy \
  --region "<AWS_REGION>" \
  --stack-name "workhive-edge-waf" \
  --template-file ops/security/workhive-edge-waf.json \
  --parameter-overrides ApplicationLoadBalancerArn="<PUBLIC_ALB_ARN>"
```

AWS WAF estima las tasas y puede tardar unos segundos en aplicar o retirar un
bloqueo; no es un contador exacto. Ajusta los tres parámetros de tasa sólo a
partir de métricas de tráfico real y de una revisión de falsos positivos.
