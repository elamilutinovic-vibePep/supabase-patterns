# supabase-patterns

A small set of practical Supabase patterns focused on:
- RLS-first ownership
- RPC as a controlled entry point
- Edge → RPC → DB (RLS) separation of concerns

## Pattern mental model
Client (anon key) + user JWT
→ (optional) Edge Function (validation, rate-limit, shaping)
→ RPC (business logic / transactions)
→ DB tables (RLS enforces ownership)

## Examples
1) rls-pattern-example (notes): owner-only table access via auth.uid()
2) rpc-pattern-example (notes): controlled write via RPC (still RLS-protected)
3) edge-to-rpc-example (contact_messages): Edge validates, RPC writes, RLS enforces ownership

## How to test quickly (no full UI)
- Create a test user in Supabase Auth (Dashboard → Authentication → Users).
- Sign in via a small JS snippet (see each example).
- Use the returned `access_token` to call queries/RPC (or Edge) as that user.
