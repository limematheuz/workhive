# WorkHive

[English](#english) · [Español](#español)

---

<a id="español"></a>

## Español

> Operaciones de servicios, desde la reserva hasta la factura.

WorkHive reúne ubicaciones, reservas, tareas, equipos, jornadas, presupuestos
y facturas en un mismo espacio de trabajo.

## Todo el flujo, conectado

| Área | Qué permite |
| --- | --- |
| Operación | Clientes, ubicaciones, reservas y tareas en un solo lugar. |
| Equipo | Asignaciones, checklists, permisos y jornadas. |
| Negocio | Presupuestos, facturas, gastos y analítica. |
| Control | Datos y acciones aislados por empresa. |

## Principios del producto

- Una tarea tiene contexto: ubicación, cliente, responsables y estado.
- Cada empresa ve solo sus propios datos y operaciones autorizadas.
- El trabajo ejecutado puede convertirse en documentos comerciales sin duplicar datos.
- La interfaz y API comparten contratos de comportamiento para reglas críticas.

## Stack

- **Frontend:** Next.js + TypeScript
- **Backend:** FastAPI + Python
- **Datos:** PostgreSQL
- **Contenedores:** Docker Compose

## Estructura

```text
frontend/          Interfaz web y pruebas de frontend
backend/           API, dominio, persistencia y pruebas de backend
test_contracts/    Contratos compartidos que validan reglas backend/frontend
docker-compose.dev.yml Desarrollo local reproducible
docker-compose.yml Producción (Caddy, HTTPS y variables productivas)
```

## Arquitectura de código

Las rutas validan peticiones, los servicios aplican reglas y permisos, y los
repositorios concentran acceso a datos.

## Desarrollo local

La entrada diaria de desarrollo es `./dev`. Necesita Git, Docker Compose, un
`backend/.env` privado y una PostgreSQL local de desarrollo ya autorizada. No
instales ni actives Node, pnpm, Python, un virtualenv o funciones de shell en el
host. El script delega en Docker Compose, espera a que backend y frontend estén
sanos y deja la terminal libre; es un atajo portable para macOS, Linux y WSL2.
También inicia `workhive_postgres` si está parado, sin recrearlo ni modificar su
volumen `workhive_pgdata`.

```bash
git clone https://github.com/limematheuz/workhive.git
cd workhive
cp backend/.env.example backend/.env
# Configura DATABASE_URL y SECRET_KEY exclusivamente para tu entorno local.
./dev --build
```

Git no incluye credenciales ni datos de desarrollo. Antes del primer arranque,
cada persona debe usar una PostgreSQL de desarrollo propia y autorizada, nunca
una base de producción. Por defecto el script espera que su contenedor se llame
`workhive_postgres`; si se llama de otro modo, se usa
`WORKHIVE_DATABASE_CONTAINER=nombre ./dev`. El `DATABASE_URL` de
`backend/.env` sigue siendo la fuente de verdad para la conexión.

En el trabajo diario basta con `./dev`: inicia backend y frontend a la vez. Usa
`./dev --build` después de cambiar un Dockerfile o las dependencias. Para
inspeccionar un problema puntualmente, usa
`docker compose -f docker-compose.dev.yml logs -f`; los health checks ya no
llenan la terminal durante el desarrollo normal.

Para apagar backend y frontend sin borrar datos ni dependencias locales:

```bash
./stop
```

El primer inicio construye las dependencias y ejecuta Alembic sobre tu base de
desarrollo existente antes de iniciar la API. `backend/.env` debe contener su
`DATABASE_URL`; la pila no crea otra PostgreSQL ni usuarios de ejemplo. Cuando
los health checks estén sanos, abre
`http://localhost:3000`; la API y su documentación de desarrollo están en
`http://localhost:8000` y `http://localhost:8000/docs`. Los cambios en
`backend/` y `frontend/` se recargan sin reinstalar dependencias. La pila de
desarrollo solo publica `localhost:3000` y `localhost:8000`; PostgreSQL conserva
la configuración de puerto que ya tuviera tu contenedor local.

El Compose conserva las credenciales de tu `backend/.env` fuera de Git y usa la
PostgreSQL local ya configurada allí. Stripe, AWS, correo, Google Calendar y
VeriFactu se desactivan durante este arranque. Docker Desktop muestra todo bajo
un único grupo `workhive`: `workhive_pgdata` es la base de datos existente;
`workhive_backend_data` conserva los medios locales; y
`workhive_frontend_node_modules` y `workhive_frontend_next` son cachés
recreables. `./stop` solo retira backend y frontend; no borra ninguno de esos
volúmenes ni toca PostgreSQL. No hace falta escribir el comando largo de Docker
Compose.

`docker-compose.yml` no es una alternativa para desarrollo: describe la ruta
de producción con Caddy, HTTPS y variables productivas obligatorias.

### Soporte de la ruta oficial

Esta ruta está soportada en macOS moderno con Docker Desktop, Windows 10/11 con
WSL2 y Docker Desktop, y Linux de 64 bits con Docker Engine y Docker Compose
v2, siempre que la PostgreSQL de desarrollo ya configurada en `backend/.env`
esté accesible en el puerto local indicado. No se promete compatibilidad con
instalaciones de Docker antiguas, Windows sin WSL2 ni máquinas donde Docker no
pueda ejecutar contenedores Linux.

### Desarrollo nativo avanzado

El desarrollo nativo sigue disponible para quien necesite depurar fuera de
contenedores, pero no es el camino de equipo. Requiere gestionar una PostgreSQL
propia, Python `3.12.13`, Node 22 y pnpm `11.19.0` mediante Corepack, además de
configurar los `.env` locales. Después se usan `backend/dev.sh` y `pnpm dev` en
`frontend/`. `workhiveup` es un atajo personal de zsh y no forma parte del flujo
documentado ni soportado.

## Calidad

Con el entorno de desarrollo en marcha, ejecuta las comprobaciones sin instalar
Node ni Python en el host:

```bash
./test-backend

docker compose -f docker-compose.dev.yml exec frontend pnpm test
docker compose -f docker-compose.dev.yml exec frontend pnpm typecheck
docker compose -f docker-compose.dev.yml exec frontend pnpm lint

docker compose -f docker-compose.dev.yml exec frontend pnpm --dir /workspace test:architecture
```

Consulta las [guardas de arquitectura](docs/engineering/ARCHITECTURE_GUARDRAILS.md)
para las reglas que CI impone sobre tamaño y separación de capas.

## Pruebas

- Backend: pruebas de API, permisos, aislamiento por empresa e integraciones.
- Frontend: pruebas unitarias de dominio, formularios, seguridad y utilidades.
- Contratos compartidos: validan reglas que deben coincidir en backend y frontend.
- E2E: escenarios de navegación críticos con Playwright.

## Seguridad

No se versionan contraseñas, tokens, certificados, claves privadas, backups ni
archivos de entorno reales.

## Releases

Prepara una nueva versión desde una rama limpia:

```bash
pnpm release:prepare 1.3.3
pnpm release:verify
```

Después de mergear la PR de release, actualiza `main` y crea el tag anotado e
inmutable con un único comando seguro:

```bash
git switch main
git pull --ff-only origin main
pnpm release:tag
```

`release:tag` se niega a ejecutarse fuera de `main`, con cambios locales, si
`main` no coincide con GitHub o si el tag ya existe. Cada merge a `main` publica
las imágenes del SHA exacto y queda pendiente de aprobación en `production`
antes de desplegar. Las Actions **Publish release images to ECR** y **Deploy
reviewed release to production** se conservan para releases semánticas y
rollbacks deliberados. Consulta el documento de
[versionado de releases](docs/operations/RELEASE_VERSIONING.md) para el flujo
completo de producción y rollback.

## WIP

- Implementar el flujo de **Solicitar acceso**: debe avisar a
  `matheus@workhive.es`, pero no crear un usuario activo ni una empresa hasta
  que un administrador de WorkHive apruebe la solicitud.
- Pulir la UX/UI del envío de presupuestos tras la validación funcional en
  producción.

---

<a id="english"></a>

## English

> Service operations, from reservation to invoice.

WorkHive brings locations, reservations, tasks, teams, time tracking, quotes,
and invoices together in one workspace.

### Connected workflow

| Area | What it enables |
| --- | --- |
| Operations | Clients, locations, reservations, and tasks in one place. |
| Team | Assignments, checklists, permissions, and time tracking. |
| Business | Quotes, invoices, expenses, and analytics. |
| Control | Company-scoped data and actions. |

### Product principles

- A task has context: location, client, assignees, and status.
- Each company sees only its own authorized data and operations.
- Completed work can become commercial documents without duplicating data.
- UI and API share behavioural contracts for critical rules.

### Stack and repository structure

- **Frontend:** Next.js + TypeScript (`frontend/`)
- **Backend:** FastAPI + Python (`backend/`)
- **Data:** PostgreSQL
- **Containers:** Docker Compose (`docker-compose.dev.yml` for local development)
- **Shared contracts:** backend/frontend rules (`test_contracts/`)

Routes validate transport input, services enforce business rules and
permissions, and repositories centralize data access.

### Local development

`./dev` is the daily development entry point. It needs Git, Docker Compose, a
private `backend/.env`, and an already authorized local development PostgreSQL
instance. Do not install or activate host Node, pnpm, Python, virtual
environments, or shell helpers. The script delegates to Docker Compose, waits
until backend and frontend are healthy, and leaves the terminal free; it is a
portable shortcut for macOS, Linux, and WSL2. It also starts
`workhive_postgres` if it is stopped, without recreating it or changing its
`workhive_pgdata` volume.

```bash
git clone https://github.com/limematheuz/workhive.git
cd workhive
cp backend/.env.example backend/.env
# Set DATABASE_URL and SECRET_KEY exclusively for your local environment.
./dev --build
```

Git does not include development credentials or data. Before the first start,
each developer must use their own authorized development PostgreSQL, never a
production database. By default the script expects its container to be named
`workhive_postgres`; with another name, run
`WORKHIVE_DATABASE_CONTAINER=name ./dev`. `backend/.env` remains the source of
truth for `DATABASE_URL`.

For daily work, run only `./dev`: it starts backend and frontend together. Use
`./dev --build` after changing a Dockerfile or dependencies. To inspect a
problem on demand, run
`docker compose -f docker-compose.dev.yml logs -f`; health checks no longer
fill the terminal during normal development.

To stop backend and frontend without deleting local data or dependencies:

```bash
./stop
```

The first start builds dependencies and runs Alembic against your existing
development database before starting the API. `backend/.env` must contain its
`DATABASE_URL`; the stack does not create another PostgreSQL instance or demo
users. Once the health checks are healthy, open
`http://localhost:3000`; the API and development documentation are available
at `http://localhost:8000` and `http://localhost:8000/docs`. Changes under
`backend/` and `frontend/` reload without reinstalling dependencies. The
development stack publishes only `localhost:3000` and `localhost:8000`;
PostgreSQL keeps whatever port configuration the existing local container had.

The development Compose keeps your `backend/.env` credentials outside Git and
uses the existing local PostgreSQL configured there. Stripe, AWS, email, Google
Calendar, and VeriFactu are disabled for this start. Docker Desktop shows one
`workhive` group: `workhive_pgdata` is the existing database;
`workhive_backend_data` retains local media; and
`workhive_frontend_node_modules` and `workhive_frontend_next` are recreable
caches. `./stop` removes only backend and frontend; it deletes none of those
volumes and never touches PostgreSQL. No long Docker Compose command is needed.

`docker-compose.yml` is not a development alternative: it describes the
production route with Caddy, HTTPS, and required production variables.

### Official-path support

This path is supported on current macOS with Docker Desktop, Windows 10/11 with
WSL2 and Docker Desktop, and 64-bit Linux with Docker Engine and Docker Compose
v2, provided the development PostgreSQL already configured in `backend/.env` is
reachable at its configured local port. It does not promise compatibility with
legacy Docker installations, Windows without WSL2, or machines unable to run
Linux containers.

### Advanced native development

Native development remains available when debugging outside containers is
needed, but it is not the team path. It requires a developer-managed PostgreSQL
instance, Python `3.12.13`, Node 22, and pnpm `11.19.0` through Corepack, plus
local `.env` configuration. Then use `backend/dev.sh` and `pnpm dev` from
`frontend/`. `workhiveup` is a personal zsh shortcut and is not part of the
documented or supported workflow.

### Quality checks

With the development environment running, run the checks without installing
Node or Python on the host:

```bash
./test-backend

docker compose -f docker-compose.dev.yml exec frontend pnpm test
docker compose -f docker-compose.dev.yml exec frontend pnpm typecheck
docker compose -f docker-compose.dev.yml exec frontend pnpm lint

docker compose -f docker-compose.dev.yml exec frontend pnpm --dir /workspace test:architecture
```

See the [architecture guardrails](docs/engineering/ARCHITECTURE_GUARDRAILS.md)
for CI-enforced size and layer-boundary rules.

### Releases

Prepare a new release version from a clean branch:

```bash
pnpm release:prepare 1.3.3
pnpm release:verify
```

After the release PR is merged, update `main` and create the immutable
annotated tag with one safe command:

```bash
git switch main
git pull --ff-only origin main
pnpm release:tag
```

`release:tag` refuses to run from another branch, with uncommitted changes,
when `main` is out of sync with GitHub, or when the tag already exists. Every
merge to `main` publishes the exact SHA images and waits for `production`
approval before deploying. **Publish release images to ECR** and **Deploy
reviewed release to production** remain available for semantic releases and
deliberate rollbacks. See [release versioning](docs/operations/RELEASE_VERSIONING.md)
for the complete production flow and rollback procedure.

### Security

Passwords, tokens, certificates, private keys, backups, real environment files,
and customer data are never versioned.
