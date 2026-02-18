# Edge → RPC → DB pattern (contact_messages)

Goal:
- Client calls Edge Function with user JWT
- Edge validates + normalizes payload
- Edge calls an RPC (as the user), so RLS applies
- DB stores message with strict RLS ownership

Why:
- Edge can do rate-limit / spam filtering / payload shaping
- RPC keeps DB logic centralized
- RLS is the final gate

Files:
- schema.sql
- policies.sql
- function.sql
- grants.sql
- edge-function.ts (example)
