# WorkHive engineering rules

These rules apply to every backend and frontend change in this repository.

- Prefer the smallest complete solution (KISS); do not add abstractions without a current use case.
- Keep shared knowledge in one place (DRY), but do not merge code that only looks similar while serving different responsibilities.
- Follow SOLID pragmatically: keep modules focused, dependencies explicit, and business rules outside routes and UI components.
- Preserve the existing layers: models persist data, schemas define API contracts, repositories query storage, services enforce business rules, and routes/controllers handle transport concerns.
- Before extending a module, check its responsibility and size budget. Extract a focused policy, repository, serializer, or domain service before a module grows beyond its architecture guardrail; never raise a budget merely to fit a feature.
- Routes must not add direct database access, and frontend pages/components/hooks must not call HTTP directly: use the corresponding backend repository/service and frontend service layer.
- Keep tenant and authorization checks in the backend service boundary. Frontend visibility is never an authorization control.
- Do not refactor unrelated code or make broad style-only changes.
- Before implementing a behavior change, map the affected entities, fields, API contracts, permissions, migrations, reporting, and downstream flows. Establish and run a focused regression-test baseline before adding the new behavior.
- For material product or domain decisions, present the proposed scope, alternatives, risks, and test plan and obtain explicit approval before implementation. Validate each completed slice in a live-like flow before requesting a PR or merge.
- Build frontend UI with the existing shadcn/ui components and patterns. Do not invent a custom primitive when shadcn/ui provides an appropriate component; if it does not, propose a compatible, accessible Tailwind-based library or primitive for approval before adding it.
- Every behavior change requires focused regression tests. Run backend tests and frontend test, typecheck, lint, and build when affected.
- For every frontend change, run `pnpm run doctor` before opening or updating a PR. React Doctor warnings are release blockers: resolve them instead of weakening its CI policy or deferring them to a later PR.
- When removing or replacing a frontend flow, delete its obsolete components and update the related architecture tests in the same change; icon-only controls must keep an accessible name.
- Never commit credentials, tokens, private keys, production environment files, private infrastructure identifiers, or customer data.
