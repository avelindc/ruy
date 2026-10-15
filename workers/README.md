# Breakout Music Worker API

This is the only backend for the Breakout Music frontend. It uses the Neon PostgreSQL database selected by `DATABASE_URL`, custom JWT auth signed and verified with `JWT_SECRET`, and an explicit `CORS_ALLOWED_ORIGINS` allowlist. There is no database-provider switch, legacy endpoint, or automatic fallback.

## Local setup

```sh
npm install
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

Set the required local variables in the ignored `.dev.vars` file. Use a dedicated empty Neon database. Review the migration SQL first; then run `npm run migrate` interactively against that database. This command applies only the new schema and has a typed confirmation. It does not import accounts or business data.

To create an administrator in the new database, run `npm run provision:admin` in an interactive terminal. It prompts for the target confirmation, new email, and hidden new password; it does not alter existing accounts or use defaults. See [ADMIN_PROVISIONING.md](ADMIN_PROVISIONING.md).

## API and authentication

Auth endpoints are under `/api/auth`: `POST /login`, `POST /register`, `GET /me`, and `POST /logout`. Login and registration return a custom JWT; protected requests send it in `Authorization: Bearer`. `/me` verifies the signature, issuer, audience, expiry, session row, account status, and role from this database. Logout revokes the session. Admin authorization reads the role assigned in `user_roles`.

The initial migration is `migrations/0001_initial.sql`. It creates a fresh schema; do not point it at a database containing data you need to preserve.

## Checks

```sh
npm run build
npm run test:auth
```

The authentication tests use an in-memory adapter and a test-only key; they do not connect to a live database or deploy the Worker.

## Cloudflare configuration

Use a new Worker name from `wrangler.toml`. Set `DATABASE_URL` and `JWT_SECRET` as Worker secrets, and `CORS_ALLOWED_ORIGINS` as a Worker variable containing the exact Pages origin. The frontend build must use the URL of that same Worker through `VITE_API_URL`. Production deployment is a separate, explicit operation.
