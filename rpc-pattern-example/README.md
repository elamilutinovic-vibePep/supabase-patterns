# RPC pattern: controlled insert (notes)

Goal: write through an RPC function (single entry point), while RLS still protects the table.

Why RPC:
- Central validation / shaping
- Stable API surface even if table changes
- Easier to add transactions later

Important:
- Use `SECURITY INVOKER` (default). The function runs as the caller, so RLS applies.

## Files
- function.sql
- grants.sql
- test-snippet.js
