# Breakout Music

Breakout Music is a React/Vite frontend backed by one Cloudflare Worker API and one Neon PostgreSQL database. Authentication uses passwords hashed with bcrypt and Worker-signed JWTs. The browser stores only the JWT and the verified user profile.

## Local development

1. Install frontend dependencies with `npm install` at the project root.
2. Copy `.env.example` to `.env.local`; it points Vite at the local Worker URL.
3. In `workers`, install dependencies with `npm install` and copy `.dev.vars.example` to `.dev.vars`.
4. Set `DATABASE_URL`, `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS` in `workers/.dev.vars`.
5. Start the API with `npm run dev --prefix workers` and the frontend with `npm run dev`.

Local setup does not create or migrate a database automatically. Review `workers/migrations/0001_initial.sql` and run `npm run migrate` from `workers` only against the intended empty Neon database. The migration script requires an interactive confirmation. Provision an administrator with `npm run provision:admin` from `workers`; the script prompts for a new email and a hidden password and never uses defaults.

## Checks

```sh
npm run build
npm run typecheck
npm run lint
npm run test:auth
git diff --check
```

The auth tests use an in-memory adapter and a test-only JWT secret. They do not contact Neon or Cloudflare.

## Environment

Frontend: `VITE_API_URL` (the single Worker API base URL).

Worker: `DATABASE_URL`, `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS`. Store these as local `.dev.vars` values for development and as Cloudflare Worker secrets/variables for deployment. Never commit them. `.env.example` and `workers/.dev.vars.example` contain placeholders only.
