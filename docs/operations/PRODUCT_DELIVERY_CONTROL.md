# Control de entregas de producto

Actualizado: 2 de septiembre de 2026.

Este documento es el control único de lo que ya está publicado, de lo que está
en curso y de lo que queda por decidir. Un punto solo pasa a hecho cuando tiene
pruebas, validación técnica y una versión publicada.

## Publicado

- ✅ v1.5.3 publicado en producción.
- ✅ Tablas de escritorio con los componentes `Table` de shadcn y tarjetas
  `Card` en móvil en Clientes, Organización, Facturas y Presupuestos.
- ✅ Pestañas adaptables: hasta cuatro opciones mantienen la fila; más de cuatro
  se presentan como selector en móvil para no comprimir ni generar scroll.
- ✅ Gestión de planes y acceso: perfiles, límites, funciones y confirmaciones
  de seguridad usan los componentes comunes.
- ✅ Flujo de personas, invitaciones y perfiles de permisos delimitado por
  empresa; el frontend no es la barrera de seguridad.

## En curso

- ⬜ Renombrar la jerga de CRM: **Oportunidad** pasa a mostrarse como
  **Seguimiento comercial**. El servicio y las rutas internas se conservan;
  cambia únicamente el lenguaje de la interfaz.
- ⬜ Paginación estándar, encabezados azules y separadores de filas en las
  listas de facturas y presupuestos.

## Pendiente, no bloqueante

- ⬜ Revisión visual y funcional de producción de las vistas publicadas.
- ⬜ Panel comercial de superadministración: MRR, empresas activas, impagos,
  upgrades, churn e ingresos por plan.
- ⬜ Stripe Checkout. Está aplazado: `BILLING_ENABLED=false` y no se añaden
  secretos ni identificadores de Stripe al repositorio. Se retomará al tener la
  entidad legal que cobrará y la configuración completa de Stripe.

## Regla para cada entrega

1. Definir alcance y criterio de aceptación antes de editar.
2. Añadir o ajustar pruebas del comportamiento.
3. Ejecutar pruebas, tipos, lint, build y React Doctor cuando cambie frontend.
4. Verificar el flujo real en local y, después del merge, en producción.
5. Marcar el punto como ✅ con la versión publicada y enlazar el cambio si hay
   una incidencia o decisión relevante.
