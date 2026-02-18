# RLS pattern: owner-only rows (notes)

Goal: each authenticated user can read/write ONLY their own rows.

Key idea:
- `user_id` is set to `auth.uid()` (default)
- RLS policies enforce `user_id = auth.uid()` on read/write

## Files
- schema.sql
- policies.sql
- test-snippet.js

## Test flow
1) Run schema.sql then policies.sql in SQL Editor.
2) Create a test user in Auth.
3) Run the JS snippet (Node or browser) to sign in and insert/read.
