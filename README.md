# Supabase Patterns

A focused collection of Supabase backend patterns for reviewing and hardening authentication, Row Level Security, database RPC functions, and Edge-to-database request paths.

The examples are intentionally small. Each one isolates a specific authorization boundary so its behavior can be inspected and tested without a complete frontend application.

## Security model

```text
client + anon key + user JWT
  → optional Edge Function
  → database RPC
  → PostgreSQL tables protected by RLS
```

Each layer has a separate responsibility:

- the client supplies the authenticated user context;
- an Edge Function may validate input and orchestrate a request;
- an RPC may define a controlled database operation;
- PostgreSQL privileges and RLS enforce the final data boundary.

Privileged `service_role` operations require explicit authorization because they bypass RLS.

## Examples

### Owner-only RLS

[`rls-pattern-example`](./rls-pattern-example/README.md) defines a `notes` table whose rows are accessible only to their authenticated owner.

The automated two-user test verifies allowed owner operations and denied cross-owner operations, including attempted ownership transfer.

### Controlled RPC write

[`rpc-pattern-example`](./rpc-pattern-example/README.md) extends the RLS example with a `create_note` database function.

The function uses the caller's database context, while explicit grants restrict execution to authenticated users. RLS remains responsible for row ownership.

### Edge → RPC → RLS

[`edge-to-rpc-example`](./edge-to-rpc-example/README.md) demonstrates an authenticated contact-message flow with separate Edge, RPC, and RLS responsibilities.

Its automated test verifies the RPC and RLS boundary behind the Edge example. It does not deploy or invoke the Edge Function itself.

## Automated tests

The repository includes two executable tests:

```text
npm run test:rls
npm run test:rpc-boundary
```

They use two Supabase Auth users to verify behavior across an ownership boundary.

Before running them:

1. use a disposable local or test Supabase project;
2. apply the SQL files in the order documented by each example;
3. create two confirmed Auth users;
4. copy `.env.example` to `.env`;
5. replace all placeholders with the disposable project values.

Install dependencies and run:

```powershell
npm install
Copy-Item .env.example .env
npm run test:rls
npm run test:rpc-boundary
```

The local `.env` file is ignored by Git. Never place real credentials in `.env.example`.

The RPC-boundary test intentionally leaves its successfully created contact-message row in the disposable project because the example defines no client-facing delete policy.

## Review guides

- [`security/security-checklist.md`](./security/security-checklist.md) provides a structured Supabase security review checklist.
- [`docs/supabase-audit.md`](./docs/supabase-audit.md) provides a fast initial security-triage procedure.

The triage procedure helps identify high-priority investigation areas. It is not a complete security audit and does not prove that a project is secure.

## Scope

This repository demonstrates focused backend patterns, not a production-ready application.

The examples do not provide a complete UI, deployment workflow, rate limiting strategy, observability setup, or exhaustive input validation. Adapt each pattern to the ownership model, privilege boundaries, and operational requirements of the reviewed system.
