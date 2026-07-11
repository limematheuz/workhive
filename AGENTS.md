# WorkHive engineering rules

These rules apply to every backend and frontend change in this repository.

- Prefer the smallest complete solution (KISS); do not add abstractions without a current use case.
- Keep shared knowledge in one place (DRY), but do not merge code that only looks similar while serving different responsibilities.
- Follow SOLID pragmatically: keep modules focused, dependencies explicit, and business rules outside routes and UI components.
- Preserve the existing layers: models persist data, schemas define API contracts, repositories query storage, services enforce business rules, and routes/controllers handle transport concerns.
- Keep tenant and authorization checks in the backend service boundary. Frontend visibility is never an authorization control.
- Do not refactor unrelated code or make broad style-only changes.
- Every behavior change requires focused regression tests. Run backend tests and frontend test, typecheck, lint, and build when affected.
- Never commit credentials, tokens, private keys, production environment files, private infrastructure identifiers, or customer data.
