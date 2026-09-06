# RLS pattern: owner-only notes

## Goal

Each authenticated user can create, read, update, and delete only their own rows.

## Ownership model

The `notes.user_id` column defaults to `auth.uid()`.

RLS independently enforces:

- `SELECT`: users see only their own rows;
- `INSERT`: users can create rows only for themselves;
- `UPDATE`: users can update only their rows and cannot transfer ownership;
- `DELETE`: users can delete only their rows.

## Files

- `schema.sql` creates the `notes` table and timestamp trigger.
- `policies.sql` enables RLS and defines owner-only policies.
- `test-rls-isolation.js` verifies allowed and denied behavior with two users.

## Test setup

Apply the SQL files to a disposable Supabase project in this order:

1. `schema.sql`
2. `policies.sql`

Create two test users in Supabase Auth.

From the repository root:

```powershell
npm install
Copy-Item .env.example .env
```

Replace the placeholder values in `.env` with the disposable project URL, anon key, and credentials for both test users.

Run:

```powershell
npm run test:rls
```

## Assertions

The test verifies that:

- A and B can each insert their own note;
- A cannot read B's note;
- B cannot read A's note;
- B cannot insert a note owned by A;
- A cannot transfer ownership of a note to B;
- B cannot update or delete A's note;
- each user can delete their own test note during cleanup.

The script exits with a non-zero status when an assertion fails.

## Scope

This is a focused ownership pattern, not a complete application. Run it only against a disposable local or test project.
