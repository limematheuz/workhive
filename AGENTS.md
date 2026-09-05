# WorkHive engineering rules

This file is the canonical repository-wide instruction source for every WorkHive task. Read and apply it before planning, inspecting, editing, testing, committing, or publishing changes. Do not create additional or nested agent-rule files unless the user explicitly requests a narrower rule set for a specific directory.

Platform instructions and the user's current request still take precedence. When instructions appear to conflict, follow the higher-priority instruction and preserve the user's stated scope and safety constraints.

## Working principles

- Prefer the smallest complete solution. Do not add abstractions without a current use case.
- Keep shared knowledge in one place, but do not merge code that only looks similar while serving different responsibilities.
- Keep modules focused, dependencies explicit, and business rules outside transport and presentation layers.
- Do not refactor unrelated code or make broad style-only changes.
- Preserve unrelated work. Inspect the working tree before editing and never delete, restore, reset, rebase, stage, or commit files by inference.
- When the current checkout contains unrelated changes and the requested work is substantial, use an isolated worktree and a dedicated working branch.
- Treat plans, audits, credentials, customer data, local configuration, and infrastructure details as private unless the user explicitly authorizes publication.

## Architecture

- Preserve the existing backend layers: models persist data, schemas define API contracts, repositories query storage, services enforce business rules, and routes/controllers handle transport concerns.
- Routes must not access the database directly. Put queries in repositories and business rules in services.
- Frontend pages, components, and hooks must not call HTTP directly. Use the frontend service layer.
- Before extending a module, check its responsibility and architecture budget. Extract a focused policy, repository, serializer, or domain service when needed; never raise a guardrail merely to fit a change.
- Before changing product behavior, map the affected entities, fields, API contracts, permissions, migrations, reporting, and downstream flows.
- Build frontend UI with the existing shadcn/ui components and patterns. Do not introduce a parallel primitive when an appropriate project component already exists.
- When replacing a frontend flow, remove obsolete components and update the related architecture tests in the same change. Icon-only controls must retain an accessible name.

## Security and authorization

- Enforce tenant isolation and authorization at backend service boundaries. Frontend visibility is never an authorization control.
- Fail closed when tenant, identity, ownership, capability, or scope information is missing or ambiguous. Global access must always require an explicit, authorized path.
- Use the canonical capability and scope resolver consistently across equivalent operations. Do not add endpoint-specific authorization shortcuts.
- Keep administrative changes in their dedicated workflows. Self-service operations must not modify administrative or tenant-assignment fields.
- Bind uploaded or generated media to an authorized owner and purpose. Deleting one record must not remove content still owned or referenced by another workflow.
- Invalidate existing sessions when authentication credentials or session-security state changes.
- Production configuration must reject empty, default, example, and placeholder secrets, even when they satisfy formatting or length requirements.
- Preserve legitimate authorized flows while converting every confirmed unauthorized reproduction into a regression test that expects denial.
- Never weaken an authorization check, test assertion, query bound, security scanner, or architecture guardrail to make a change pass.

## Implementation workflow

1. Read this file and the user's complete request before executing repository work.
2. Inspect repository status, current context, and relevant existing code before assigning ownership or changing files.
3. Establish a focused regression-test baseline for the behavior being changed.
4. Implement the smallest complete change through the existing architecture layers.
5. Add or update focused regression tests for every behavior change, including authorized and denied paths where permissions are involved.
6. Run affected tests first, then broaden validation only as justified by the change or by failures.
7. Inspect the final diff for unrelated edits, formatting churn, generated artifacts, and sensitive information.
8. Before committing, inspect the exact staged file list. Stage explicit implementation paths instead of staging the whole working tree when private or unrelated files may exist.
9. Before publishing, verify that the commit contains only authorized material and that local and remote state match the intended result.

## Validation

- Run backend tests for backend behavior changes.
- Run frontend tests, type checking, linting, build, and the project doctor command when frontend code changes.
- Run the repository architecture checks after structural changes and after extracting responsibilities from oversized modules.
- Run configured static analysis, dependency auditing, and security checks for security-sensitive backend work.
- Use the project's normal test feature configuration. Do not disable unrelated features globally to hide failures.
- Re-run bounded-query tests when authorization adds database work. Remove redundant queries instead of weakening thresholds.
- Prefer targeted formatting. Do not apply repository-wide formatting to legacy files unless the task explicitly requires it.
- Run a whitespace and patch-integrity check before considering the change complete.
- Validate material completed behavior in a live-like flow before requesting publication or merge.

## Publication and repository safety

- Never commit credentials, tokens, private keys, production environment files, private infrastructure identifiers, customer data, local machine paths, or private audit material.
- A request to publish implementation code does not authorize publishing plans, audit narratives, reproduction details, local notes, or unrelated artifacts.
- Review staged filenames and staged content before every commit. Stop if any file falls outside the authorized scope.
- Do not include private security narratives in commit messages, pull-request descriptions, or release notes.
- Do not claim that validation, publication, deployment, or merge succeeded without checking the corresponding current state.
