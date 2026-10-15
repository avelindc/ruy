# Provision a new Neon admin account

`npm run provision:admin` creates one new admin identity in the selected Neon database. It never promotes an existing account and does not create or migrate tables.

Before running it, set `DATABASE_URL` for the **new authentication database** in the ignored `workers/.dev.vars` file or the current shell; a shell value takes precedence. The script prints only the Neon hostname, requires a typed database confirmation, takes a new email and password interactively, hides password input, and asks for a final create confirmation. Choose a new password of at least 16 characters.

The `public.users` and `public.user_roles` tables must already exist. The script inserts a bcrypt password hash and an `admin` role row in one transaction; if the email already exists or a check fails, it rolls back without modifying an account.

This command is a local provisioning mechanism only. It does not deploy a Worker or change Cloudflare settings.
