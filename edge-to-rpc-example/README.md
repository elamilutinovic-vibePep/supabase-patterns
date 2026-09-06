# Edge → RPC → DB pattern

## Goal

Demonstrate a layered write flow for authenticated contact messages:

```text
client → Edge Function → RPC → PostgreSQL RLS
```

Each layer has a different responsibility. The Edge Function does not replace database authorization, and the RPC does not replace RLS.

## Responsibilities

### Edge Function

- accepts only `POST`;
- requires a Bearer token;
- parses and normalizes the request payload;
- rejects obviously invalid input early;
- creates a Supabase client with the `anon` key and forwarded user JWT;
- calls the RPC in the user's database context;
- converts the result into an HTTP response.

### RPC

- repeats validation required by the named database operation;
- normalizes stored values;
- inserts the contact message as the caller;
- returns the created row.

### RLS

- verifies that the stored `user_id` matches `auth.uid()`;
- prevents one user from reading another user's messages;
- remains the final ownership boundary.

## Files

- `schema.sql` creates `contact_messages`.
- `policies.sql` enables owner-only insert and select policies.
- `function.sql` defines `create_contact_message`.
- `grants.sql` restricts RPC execution to `authenticated`.
- `edge-function.ts` demonstrates JWT forwarding from Edge to RPC.
- `test-rpc-boundary.js` verifies RPC access, validation, normalization, and cross-user read isolation.

## SQL setup

Apply these files to a disposable Supabase project in order:

1. `schema.sql`
2. `policies.sql`
3. `function.sql`
4. `grants.sql`

Create two users in Supabase Auth.

From the repository root:

```powershell
npm install
Copy-Item .env.example .env
```

Replace the placeholders in `.env` with the disposable project URL, anon key, and credentials for users A and B.

Run:

```powershell
npm run test:rpc-boundary
```

## Test assertions

The test verifies that:

- an anonymous caller cannot execute the RPC;
- authenticated user A can create a message;
- the RPC normalizes the email address;
- a direct RPC call cannot bypass the email validation performed by Edge;
- user B cannot read user A's message.

The successful test row remains in the disposable project because this focused example intentionally defines no client-facing delete policy.

## Edge status

`edge-function.ts` is an implementation example. The automated script tests the RPC and RLS boundary behind it; it does not deploy or invoke the Edge Function.

## Scope and limitations

The email check is intentionally minimal and demonstrates consistent validation placement, not complete email-address validation.

Because authenticated callers can execute the RPC directly, rules required by the database operation must not exist only in Edge code.

This is a focused architectural pattern, not a production-ready contact system.
