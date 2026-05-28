# Traefik-UI Agents

## Project Structure
- **Monorepo** (Bun + Turbo): `packages/backend`, `packages/frontend`, `packages/shared`
- **Backend**: Hono (TypeScript), SQLite (Bun:sqlite), JWT auth, Bun test
- **Frontend**:
  - Current: vanilla JS (`.html` + `.js` assets, served by backend in dev)
  - Target: React + Vite + Tailwind + shadcn/ui
- **Shared**: TypeScript types shared across packages

## Conventions

### Spec-Driven Development (from spec-driven-development skill)
- **Spec first**: Before writing code, create or update a spec in `.agents/plans/`
- **REASONS canvas**: Clarify Requirements, Entities, Approach, Structure, Operations, Norms, Safeguards
- **Spec is truth**: Spec and code must stay in sync — update spec when code changes
- **Design before implement**: Lock intent before writing code

### Error Handling
- Return JSON errors: `{ error: "message", code?: string }` with appropriate HTTP status
- Never `throw` for expected errors — return `c.json(...)` responses
- Never `process.exit()` — let errors propagate or handle gracefully
- Log actionable info only: use `logInfo`, `logError` from `src/lib/logger.ts` (structured, no secrets)

### Auth Pattern
- **Current**: JWT Bearer token (`Authorization: Bearer <token>`), local passwords (argon2id), `is_admin` flag on users table
- **Target**: OIDC SSO + RBAC with roles/permissions/groups
- Backend sets `userId` and `username` on Hono context via `authMiddleware`
- Spec for RBAC migration: `.agents/plans/rbac-sso-react-migration.md`

### Frontend During Migration
- Keep vanilla JS frontend fully working at all times
- React frontend is additive — vanilla frontend continues serving users until React is feature-complete
- Backend API routes must maintain backward compatibility

### Testing Norms
- **Backend**: `bun test` (Bun's built-in test runner)
- **Frontend** (React): Vitest + React Testing Library
- **E2E**: Playwright

### Database
- SQLite via `bun:sqlite`
- Migration system to be added (Phase 1A per migration plan)
- Schema in `src/db/schema.ts` — use migrations for schema changes going forward

### Naming & Code Style
- Enable/enforce via ESLint + Prettier
- Routes return `c.json()` — no side effects in route handlers
- Business logic lives in `src/lib/` or `src/services/` — not in route handlers
- Name tests as sentences (e.g., `it("returns 401 when token is missing")`)

### Running Commands
```sh
bun run dev        # All packages (turbo)
bun run build      # All packages
bun run test       # All packages
bun run typecheck  # All packages
bun run lint       # All packages
```
