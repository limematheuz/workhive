# Stripe Checkout en sandbox

Este procedimiento prueba una suscripción de WorkHive sin mover dinero. Nunca
copies claves de Stripe al repositorio, a un ticket o a un chat.

## Qué cubre

Un administrador de una empresa existente elige Base, Medio, Top o Empresarial,
elige la periodicidad y llega al Checkout alojado de Stripe. El webhook firmado
actualiza la suscripción y las capacidades de esa misma empresa.

Los planes personalizados siguen siendo comerciales: no generan Checkout
automático.

## Configuración local

En `backend/.env`, que no se versiona, configura valores exclusivamente del
entorno de prueba de Stripe:

```dotenv
BILLING_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BASIC_MONTHLY_PRICE_ID=price_...
STRIPE_BASIC_ANNUAL_PRICE_ID=price_...
STRIPE_MEDIUM_MONTHLY_PRICE_ID=price_...
STRIPE_MEDIUM_ANNUAL_PRICE_ID=price_...
STRIPE_TOP_MONTHLY_PRICE_ID=price_...
STRIPE_TOP_ANNUAL_PRICE_ID=price_...
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_...
STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=price_...
```

Cada identificador corresponde al precio mensual o anual del producto
equivalente de WorkHive en el catálogo sandbox. No reutilices el identificador
de un producto distinto ni sustituyas el precio anual por el mensual.
Antes de crear el Checkout, WorkHive comprueba en Stripe que el precio está
activo, es EUR y coincide con el importe y la periodicidad publicados.

En `frontend/.env.local`, configura:

```dotenv
NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED=true
```

Reinicia backend y frontend después de editar sus variables. La aplicación no
activa Checkout si faltan claves, secreto de webhook o cualquiera de los ocho
precios canónicos.

## Webhook local

1. Ejecuta `stripe login` y aprueba el acceso a **WorkHive - desarrollo** en
   modo sandbox.
2. En otra terminal, ejecuta:

   ```bash
   stripe listen --forward-to localhost:8000/api/v1/billing/webhook
   ```

3. Copia únicamente en `backend/.env` el `whsec_...` que muestra esa terminal.
   Este secreto pertenece a ese listener local y cambia al iniciarlo de nuevo.
4. Reinicia el backend y vuelve a dejar el listener activo.

El webhook recibe `checkout.session.completed`, los eventos
`customer.subscription.*`, `invoice.paid` e `invoice.payment_failed`. Los
eventos se validan con la firma de Stripe y se procesan de forma idempotente.

## Prueba funcional

1. Entra con un administrador de una empresa existente que no tenga una
   suscripción Stripe activa.
2. Abre `/subscription`, elige mensual o anual y pulsa **Elegir este plan**.
3. El enlace protegido conserva el plan y la periodicidad si requiere iniciar
   sesión.
4. En Checkout usa la tarjeta de prueba `4242 4242 4242 4242`, una fecha futura
   y cualquier CVC. No uses una tarjeta real.
5. Verifica en el listener que Stripe entregó los eventos y que la empresa
   conserva el mismo cliente Stripe, plan y estado activo.
6. Repite la prueba con anual. Para una empresa que ya tenga una suscripción
   activa, usa el portal de facturación; WorkHive bloquea un segundo Checkout
   para no duplicar suscripciones.

## Paso a producción

Cuando la entidad legal esté configurada en Stripe:

1. Crea los mismos cuatro productos y sus ocho precios en modo activo.
2. Sustituye en secretos de despliegue los ocho `price_...`, `sk_test_...` y
   `whsec_...` por sus equivalentes live.
3. Define `BILLING_ENABLED=true` y
   `NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED=true` en el despliegue.
4. Registra `https://<api-domain>/api/v1/billing/webhook` como endpoint HTTPS
   de Stripe y selecciona los mismos eventos.
5. Ejecuta la prueba de una compra antes de anunciar el cobro.

No se modifica el código para pasar de sandbox a producción: solo cambian los
secretos e identificadores del mismo entorno de Stripe.
