# Supabase Security Review Checklist

## Purpose

Use this checklist when reviewing authentication context, RLS, database functions, Edge Functions, and Storage access in an existing Supabase project.

A checked item is not proof of security. Verify behavior with identities from at least two ownership or tenant boundaries.

## 1. Identify exposed data paths

List every way user-controlled requests can reach data:

- direct Data API queries;
- database RPC functions;
- Edge Functions;
- Storage operations;
- server-side jobs or administrative endpoints.

For each path, record which key and user context reach PostgreSQL.

## 2. Verify standard privileges and RLS status

For every user-facing table, check:

- which roles have table privileges;
- whether RLS is enabled;
- whether the table owner, a superuser, or a `BYPASSRLS` role is used;
- whether applicable policies exist for each required operation.

When RLS is enabled and no applicable policy exists, PostgreSQL uses default deny. When RLS is disabled, policies are not applied and standard table privileges determine access.

## 3. Define the ownership model

For each protected row, answer:

- Who owns it?
- Is ownership direct (`user_id`) or relational (`family_id`, `organization_id`, `student_id`)?
- Which table is the source of truth?
- Can an ordinary client modify that ownership source?

Common ownership columns include:

```text
user_id
family_id
organization_id
student_id
```

Protect membership and role tables as carefully as the data policies that depend on them.

## 4. Review SELECT behavior

A `SELECT` policy uses `USING` to determine which existing rows are visible.

Example:

```sql
using (user_id = auth.uid())
```

Check for:

- `USING (true)` on private data;
- policies that cross tenant boundaries;
- missing membership conditions;
- multiple permissive policies whose combined `OR` behavior is broader than intended.

A missing applicable policy under enabled RLS denies access; it does not expose all rows.

## 5. Review INSERT behavior

An `INSERT` policy uses `WITH CHECK` to validate the proposed new row.

Example:

```sql
with check (user_id = auth.uid())
```

Check whether the caller can:

- provide another user's owner ID;
- insert into another tenant;
- manipulate a membership or role used by later authorization checks.

Defaults such as `user_id default auth.uid()` improve the normal path, but RLS must still validate the resulting row.

## 6. Review UPDATE behavior

An `UPDATE` can require two decisions:

```sql
using (user_id = auth.uid())
with check (user_id = auth.uid())
```

- `USING` determines which existing rows can be targeted.
- `WITH CHECK` validates the proposed updated row.

If `WITH CHECK` is omitted, PostgreSQL reuses the `USING` expression for the new row. Define it explicitly when the intended new-row rule should be clear or differs from row visibility.

Also verify the required `SELECT` policy and privileges for queries that read or return updated rows.

## 7. Review DELETE behavior

A `DELETE` policy uses `USING` to determine which existing rows can be targeted.

Test both:

- an owner deleting an allowed row;
- a different user attempting to delete that row.

A blocked row is often filtered out rather than returned as an authorization error, so inspect the affected-row result.

## 8. Review database functions

For every exposed function, check:

- `SECURITY INVOKER` or `SECURITY DEFINER`;
- the caller identity seen by `auth.uid()`;
- table privileges and RLS behavior inside the function;
- input validation and transactional boundaries;
- the function's `EXECUTE` privileges.

For an authenticated-only function:

```sql
revoke execute on function public.example_function(text)
from public, anon;

grant execute on function public.example_function(text)
to authenticated;
```

A `SECURITY DEFINER` function requires additional review of authorization logic, owner privileges, and a safe `search_path`.

## 9. Review Edge Function identity propagation

When PostgreSQL should enforce RLS for the user, create the client with the anon key and forward the user's authorization header.

```typescript
createClient(url, anonKey, {
  global: {
    headers: {
      Authorization: authHeader,
    },
  },
});
```

Check that:

- the header exists and has the expected Bearer format;
- the function does not silently replace user context with `service_role`;
- validation required by a directly callable RPC does not exist only in Edge code.

## 10. Review service-role usage

`service_role` bypasses RLS.

For every use, document:

- why privileged access is required;
- how the caller is authenticated;
- where authorization is checked;
- which rows or objects the operation may access;
- whether user-controlled identifiers are accepted.

User-facing reads with `service_role` are high risk unless authorization is enforced explicitly before privileged access.

## 11. Review Storage authorization

Check:

- whether each bucket is intentionally public or private;
- whether object paths encode the correct tenant boundary;
- whether Storage policies validate membership;
- whether clients can modify the membership source;
- whether signed URLs are generated only after authorization.

A private bucket prevents unrestricted public access. It does not by itself prove tenant isolation or safe signed-URL generation.

## 12. Verify behavior

Use at least two users from different ownership or tenant boundaries.

Test:

- allowed read, insert, update, and delete paths;
- cross-owner and cross-tenant reads;
- inserts with another user's owner ID;
- attempted ownership transfer during update;
- direct RPC calls that bypass Edge validation;
- anonymous access to authenticated-only functions;
- Storage access across tenant paths.

Tests must assert returned ownership and affected-row counts, not only successful HTTP status codes.

## Review output

For every finding, record:

1. affected asset and request path;
2. observed behavior;
3. expected authorization rule;
4. impact;
5. root cause;
6. recommended remediation;
7. verification required after the fix.

## References

- [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL: CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [Supabase: Database Functions](https://supabase.com/docs/guides/database/functions)
