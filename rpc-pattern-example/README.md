# RPC pattern: controlled note creation

## Goal

Expose a named `create_note` operation while keeping row ownership enforced by RLS.

The RPC provides a stable write interface and a place for validation or future transactional logic. It does not replace table-level authorization.

## Dependency

This example extends the sibling `rls-pattern-example`.

Before creating the RPC, apply:

1. `../rls-pattern-example/schema.sql`
2. `../rls-pattern-example/policies.sql`
3. `function.sql`
4. `grants.sql`

The first two files create `public.notes` and its owner-only RLS policies.

## Responsibilities

The RPC:

- accepts only `title` and `body`;
- rejects an empty title;
- trims the title;
- inserts through the caller's database context;
- returns the created `notes` row.

RLS:

- assigns and verifies ownership through `auth.uid()`;
- prevents callers from creating or accessing another user's rows;
- remains effective even if another write path is added later.

## Security model

`create_note` uses `SECURITY INVOKER`, so it runs with the caller's privileges and remains subject to RLS.

`grants.sql` removes execution rights from `PUBLIC` and `anon`, then grants execution to `authenticated`.

## Files

- `function.sql` defines `create_note`.
- `grants.sql` restricts function execution.
- `test-snippet.js` demonstrates one authenticated successful call.

The current RPC snippet demonstrates only the allowed path. Cross-user ownership isolation is verified separately by `../rls-pattern-example/test-rls-isolation.js`.

## Scope

This is a focused pattern for a controlled database operation, not a rule that every simple CRUD write requires an RPC.
