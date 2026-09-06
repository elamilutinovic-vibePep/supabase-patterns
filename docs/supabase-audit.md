# Supabase Backend Security Triage

## Purpose

Use this procedure for a fast initial review of an existing Supabase backend.

Typical use cases include:

- assessing an AI-generated or no-code backend;
- reviewing a Lovable project;
- investigating unexpected data access;
- estimating the scope of a security-hardening task;
- identifying areas that require a deeper review.

This is a triage procedure, not a complete security audit.

A short review can reveal obvious high-risk patterns and help prioritize further investigation. It cannot prove that the project is secure or reliably detect a fixed percentage of all issues.

## Expected output

Record:

- exposed data paths;
- ownership and tenant boundaries;
- immediately visible high-risk patterns;
- areas that could not be verified;
- tests and deeper inspection required next.

Do not assign a final security rating based only on this procedure.

---

## Step 1 — Map exposed data paths

Identify every path through which a user-controlled request can reach data:

- direct Data API queries;
- database RPC functions;
- Edge Functions;
- Storage operations;
- server-side endpoints, jobs, and webhooks.

For each path, determine:

- which Supabase key is used;
- whether a user JWT reaches PostgreSQL;
- which database role executes the request;
- whether RLS is expected to apply;
- where authentication and authorization are checked.

Red flags include:

- an undocumented privileged endpoint;
- user-controlled identifiers reaching privileged queries;
- assumptions that requests always pass through one application layer.

---

## Step 2 — Check table privileges and RLS status

For every user-facing table, verify:

- which roles have table privileges;
- whether RLS is enabled;
- whether applicable policies exist for required operations;
- whether access occurs through a role that bypasses RLS.

When RLS is enabled and no applicable policy exists, PostgreSQL uses default deny.

When RLS is disabled, policies are not applied. Access then depends on ordinary table privileges and the role executing the query.

Example:

```sql
alter table public.orders enable row level security;
```

Red flags include:

- private user data exposed through a client-accessible table without RLS;
- privileged access whose authorization model is undocumented;
- testing RLS through a table owner, superuser, or `BYPASSRLS` role.

A missing policy is not automatically data exposure. Under enabled RLS, it may instead break an intended operation.

---

## Step 3 — Identify the ownership model

For each protected resource, determine:

- who may read it;
- who may create or change it;
- whether access is based on ownership, membership, role, or another relationship;
- which table is the authorization source of truth;
- whether an ordinary client can modify that source.

Common boundary columns include:

```text
user_id
family_id
organization_id
student_id
```

Ownership does not have to be stored directly on every table. It may be derived through a protected relationship.

Example:

```text
attempt
  → student
  → family membership
  → authenticated user
```

Red flags include:

- no identifiable authorization path;
- tenant identifiers that can disagree across related rows;
- clients able to grant themselves membership or privileged roles;
- policies depending on an unprotected membership table.

---

## Step 4 — Inspect operation-specific policies

### SELECT

A `SELECT` policy uses `USING` to determine which existing rows are visible.

Example:

```sql
using (user_id = auth.uid())
```

Check for:

- `USING (true)` on private data;
- incomplete tenant conditions;
- multiple permissive policies whose combined `OR` behavior is too broad;
- helper functions that derive access from mutable or unprotected data.

A missing applicable `SELECT` policy under enabled RLS denies the rows. It does not make them globally visible.

### INSERT

An `INSERT` policy uses `WITH CHECK` to validate the proposed row.

Example:

```sql
with check (user_id = auth.uid())
```

Check whether a caller can:

- insert a row for another user;
- select another tenant identifier;
- create a membership or role that grants later access.

A default such as `user_id default auth.uid()` supports the normal insert path but does not replace authorization.

### UPDATE

An `UPDATE` policy can apply separate rules to the existing and proposed row:

```sql
using (user_id = auth.uid())
with check (user_id = auth.uid())
```

- `USING` determines which existing rows may be targeted.
- `WITH CHECK` validates the proposed new row.

When `WITH CHECK` is omitted, PostgreSQL can reuse the `USING` expression for the new row. Its absence is therefore not automatically a vulnerability.

Define `WITH CHECK` explicitly when it makes the intended rule clearer or when the new-row rule differs from visibility.

Also inspect the privileges and `SELECT` policy required by the actual update query.

### DELETE

A `DELETE` policy uses `USING` to determine which existing rows may be targeted.

Verify affected-row behavior. A disallowed row may be filtered out instead of producing an explicit authorization error.

---

## Step 5 — Review RPC functions

For every client-accessible function, inspect:

- `SECURITY INVOKER` or `SECURITY DEFINER`;
- function ownership;
- the effective `search_path`;
- `EXECUTE` privileges;
- the caller identity visible through `auth.uid()`;
- validation and authorization logic;
- RLS behavior for accessed tables.

For an authenticated-only function:

```sql
revoke execute on function public.example_function(text)
from public, anon;

grant execute on function public.example_function(text)
to authenticated;
```

A `SECURITY INVOKER` function normally runs with the caller's privileges and remains subject to the caller's RLS context.

A `SECURITY DEFINER` function requires additional review because it runs with the function owner's privileges. Verify explicit authorization, minimal privileges, and a safe `search_path`.

Red flags include:

- public execution of an intended authenticated-only operation;
- a definer function trusting user-supplied ownership identifiers;
- authorization assumed to exist only in the calling Edge Function;
- functions returning data without a verified ownership or tenant rule.

---

## Step 6 — Review Edge Functions

Search for Supabase client creation and identify the intended execution context.

When PostgreSQL should apply RLS as the user, forward the caller's authorization header through a client created with the anon key:

```typescript
createClient(url, anonKey, {
  global: {
    headers: {
      Authorization: authHeader,
    },
  },
});
```

Verify that:

- the Bearer token is required and validated;
- the caller's JWT reaches PostgreSQL;
- `auth.uid()` represents the intended user;
- validation required by a directly callable RPC is not implemented only in Edge code;
- errors do not disclose sensitive internals.

A client created with `service_role` bypasses RLS. This can be legitimate for a privileged backend operation, but the Edge Function must then perform explicit authorization before accessing data.

Red flags include:

- `service_role` used merely to make a failing query work;
- privileged reads based only on a user-supplied row ID;
- an endpoint that authenticates a user but never verifies permission for the requested resource.

---

## Step 7 — Review service-role usage

For every use of `service_role`, document:

- why RLS bypass is necessary;
- how the caller is authenticated;
- how authorization is enforced;
- which rows or objects may be accessed;
- whether user-controlled identifiers influence the query;
- whether a narrower database operation could reduce the privilege boundary.

`service_role` is not automatically a vulnerability. Unjustified or insufficiently authorized use is a high-risk finding.

Never expose the service-role key to a browser or other untrusted client.

---

## Step 8 — Check Storage authorization

For each bucket, determine:

- whether it is intentionally public or private;
- what information object paths encode;
- which roles may upload, read, update, and delete;
- how tenant or owner membership is verified;
- how signed URLs are authorized and generated.

A public bucket is appropriate only for intentionally public assets.

A private bucket prevents unrestricted public retrieval, but it does not by itself prove tenant isolation.

Do not assume that a condition such as:

```sql
owner_id = auth.uid()
```

is sufficient for every storage model. Authorization may instead depend on a protected tenant path or membership relationship.

Red flags include:

- private user documents placed in a public bucket;
- path-based authorization without validated path structure;
- signed URLs generated before checking access;
- Storage policies relying on a membership source that clients can modify.

---

## Step 9 — Inspect duplicated authorization logic

Search application and database code for repeated ownership or tenant conditions.

Examples include:

```text
where user_id =
family_id =
organization_id =
```

Duplication is not automatically a vulnerability. It becomes risky when different paths implement conflicting versions of the same authorization rule.

Determine whether the source of truth is:

- an RLS policy;
- a protected helper function;
- an explicitly privileged server operation;
- or an undocumented mixture of application checks.

Database authorization should remain effective when a client bypasses the expected frontend flow.

---

## Step 10 — Perform focused behavioral tests

Static inspection identifies hypotheses. Verify important boundaries with at least two users from different ownership or tenant contexts.

Test:

- allowed operations for the owner;
- cross-owner and cross-tenant reads;
- insertion with another user's owner ID;
- attempted ownership transfer during update;
- affected-row results for blocked updates and deletes;
- anonymous access to authenticated-only RPCs;
- direct RPC calls that bypass Edge validation;
- Storage access across tenant paths.

Assert returned identities, ownership fields, and affected-row counts. A successful HTTP response alone does not prove correct authorization.

Use only a disposable local or test project when tests create, modify, or delete data.

---

## Initial finding priorities

### Immediate investigation

Examples:

- service-role key exposed to an untrusted client;
- privileged endpoint with missing authorization;
- reproducible cross-user or cross-tenant access;
- private files publicly retrievable;
- client-writable membership or role escalation.

### Significant concern

Examples:

- inconsistent RLS coverage;
- unsafe `SECURITY DEFINER` function;
- overbroad permissive policies;
- missing ownership validation on a write path;
- tenant relationships without enforced integrity.

### Requires verification

Examples:

- complex policies whose behavior has not been tested;
- missing policies that may represent either intentional deny or broken functionality;
- duplicated rules that appear consistent but lack a shared source of truth;
- privileged operations whose caller restrictions are not documented.

Priority reflects the current evidence and potential impact. It is not a complete project-level risk rating.

---

## Triage summary template

```text
Supabase Backend Security Triage

Scope reviewed:
- tables:
- RPC functions:
- Edge Functions:
- Storage buckets:
- other privileged paths:

Execution contexts identified:
- user JWT / authenticated:
- anon:
- service_role or other privileged role:

Immediate findings:
- [asset and request path]
- [observed behavior]
- [potential impact]

Areas requiring deeper review:
- [unverified ownership or tenant rule]
- [function or endpoint requiring behavioral testing]

Recommended next actions:
1. [contain or verify the highest-priority finding]
2. [perform two-user boundary test]
3. [complete operation-specific RLS and privilege review]

Limitations:
- [assets not reviewed]
- [tests not executed]
- [environment or access limitations]
```

---

## Common patterns worth investigating

Frequently encountered patterns include:

1. RLS disabled on a client-accessible private table.
2. `service_role` used to bypass an unexplained authorization failure.
3. Ownership derived from an unprotected membership table.
4. Public Storage used for data that users expect to remain private.
5. Authenticated-only RPCs executable by `anon`.
6. Authorization implemented only in frontend or Edge code.
7. Policies tested with one identity but not across ownership boundaries.

These are investigation prompts, not findings until confirmed in the reviewed project.

---

## Core principle

The database enforces data authorization.

Privileged application code explicitly enforces authorization before bypassing database protections.

Edge Functions and APIs orchestrate trusted operations.

The frontend may guide user behavior, but it is never the security boundary.

---

## References

- [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL: CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase: Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
